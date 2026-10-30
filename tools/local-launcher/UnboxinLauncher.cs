using System;
using System.IO;
using System.Drawing;
using System.Diagnostics;
using System.Net.Http;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Collections.Generic;

static class Program {
 public static string ApplicationPath(string root) {
  if(File.Exists(Path.Combine(root,"server.ts")))return root;
  return Path.Combine(root,"work/app");
 }
 [STAThread] static int Main(string[] args) {
  string root=Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,".."));
  if(args.Length>0 && args[0]=="--self-test") {
   root=ApplicationPath(root);
   bool ok=File.Exists(Path.Combine(root,"server.ts")) && File.Exists(Path.Combine(root,"dist/index.html")) && Directory.Exists(Path.Combine(root,"node_modules/tsx"));
   File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"launcher-self-test.txt"),ok?"PASS: application, build and dependencies found. No database changes.":"FAIL: required application files missing.");return ok?0:1;
  }
  bool created;
  using(var mutex=new Mutex(true,"Local\\UnboxinLocalLauncher",out created)) {
   Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
   if(!created){MessageBox.Show("Launcher Unboxin sudah terbuka. Gunakan jendela tersebut.");return 0;}
   Application.Run(new Launcher(root));return 0;
  }
 }
}
sealed class Launcher:Form {
 const string Url="http://127.0.0.1:3001/";
 const string BrowserUrl="http://localhost:3001/";
 readonly string app,logs,backups;
 readonly Label status=new Label();
 readonly Button start=new Button(),open=new Button(),stop=new Button();
 readonly HttpClient http=new HttpClient(new HttpClientHandler{UseProxy=false});
 bool busy;
 public Launcher(string root) {
  app=Program.ApplicationPath(root);logs=Path.Combine(app,"runtime/logs");backups=Path.Combine(app,"runtime/backups");http.Timeout=TimeSpan.FromMilliseconds(1500);
  Text="Unboxin - Server Lokal";ClientSize=new Size(540,275);FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;StartPosition=FormStartPosition.CenterScreen;BackColor=Color.White;Font=new Font("Segoe UI",10);
  Controls.Add(new Label{Text="unboxin.id",Font=new Font("Segoe UI",24,FontStyle.Bold),ForeColor=Color.FromArgb(15,118,110),Bounds=new Rectangle(24,18,480,48)});
  Controls.Add(new Label{Text="Server dan database di laptop ini",Bounds=new Rectangle(26,72,480,25)});
  status.Text="Memeriksa server...";status.Bounds=new Rectangle(26,111,484,55);Controls.Add(status);
  Setup(start,"Nyalakan server",26,160);Setup(open,"Buka aplikasi",193,150);Setup(stop,"Hentikan server",350,164);
  start.BackColor=Color.FromArgb(15,118,110);start.ForeColor=Color.White;
  Controls.Add(new Label{Text="Laptop harus menyala. Tutup launcher tidak menghentikan server.",Bounds=new Rectangle(26,231,490,36),ForeColor=Color.DimGray,Font=new Font("Segoe UI",9)});
  start.Click+=async(s,e)=>await StartServer();stop.Click+=async(s,e)=>await StopServer();
  open.Click+=async(s,e)=>{if(busy)return;if(await Healthy())Browser();else status.Text="Server belum siap. Klik Nyalakan server.";};
  Shown+=async(s,e)=>await StartServer();FormClosing+=(s,e)=>{if(busy){e.Cancel=true;status.Text="Tunggu proses selesai sebelum menutup launcher.";}};
 }
 void Setup(Button b,string text,int x,int width){b.Text=text;b.Bounds=new Rectangle(x,177,width,40);b.FlatStyle=FlatStyle.Flat;b.Cursor=Cursors.Hand;Controls.Add(b);}
 void Busy(bool value){busy=value;start.Enabled=open.Enabled=stop.Enabled=!value;UseWaitCursor=value;}
 async Task<bool> Healthy(){try{var r=await http.GetAsync(Url+"api/health");if(!r.IsSuccessStatusCode)return false;var d=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(await r.Content.ReadAsStringAsync());return d.ContainsKey("localTrial") && d["localTrial"] is bool && (bool)d["localTrial"] && d.ContainsKey("service") && (string)d["service"]=="Backend Logic Processor - Sistem Aplikasi Retur Gudang e-Commerce";}catch{return false;}}
 async Task<bool> PortBusy(){using(var tcp=new TcpClient()){try{var connecting=tcp.ConnectAsync("127.0.0.1",3001);if(await Task.WhenAny(connecting,Task.Delay(500))!=connecting)return false;await connecting;return tcp.Connected;}catch{return false;}}}
 string StartupFailure(string file){try{if(!File.Exists(file))return null;var data=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(file));return data.ContainsKey("state") && (string)data["state"]=="failed" ? (string)data["message"] : null;}catch{return null;}}
 void Browser(){try{Process.Start(new ProcessStartInfo(BrowserUrl){UseShellExecute=true});}catch{status.Text="Server aktif. Buka browser: "+BrowserUrl;}}
 string Node(){string p=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"nodejs/node.exe");if(File.Exists(p))return p;foreach(string dir in (Environment.GetEnvironmentVariable("PATH")??"").Split(';')){try{p=Path.Combine(dir.Trim('"'),"node.exe");if(File.Exists(p))return p;}catch{}}throw new Exception("Node.js tidak ditemukan.");}
 void Log(string s){try{lock(this){File.AppendAllText(Path.Combine(logs,"launcher-server.log"),s+Environment.NewLine);}}catch{}}
 async Task StartServer(){if(busy)return;Busy(true);try{
  if(!File.Exists(Path.Combine(app,"server.ts")) || !File.Exists(Path.Combine(app,"dist/index.html")))throw new Exception("Folder aplikasi tidak ditemukan. Letakkan EXE di folder launcher-build asal.");
  status.Text="Memeriksa server lokal...";
  if(!await Healthy()){
   if(await PortBusy()){
    status.Text="Port 3001 sedang dipakai. Memeriksa server yang sudah berjalan...";
    bool recovered=false;for(int attempt=0;attempt<3;attempt++){if(await Healthy()){recovered=true;break;}await Task.Delay(250);}
    if(recovered){status.Text="Server sudah aktif: "+BrowserUrl;Browser();return;}
    throw new Exception("Port 3001 sedang dipakai, tetapi server Unboxin belum merespons. Tidak ada server kedua yang dijalankan. Periksa jendela server lama atau runtime\\logs\\launcher-server.log.");
   }
   Directory.CreateDirectory(logs);status.Text="Menyalakan server. Tunggu hingga siap...";
   string startupFile=Path.Combine(logs,"startup-"+Guid.NewGuid().ToString("N")+".json");
   var info=new ProcessStartInfo(Node(), "\"" + Path.GetFullPath(Path.Combine(app,"tools/local-launcher/start-server.cjs")) + "\" \"" + startupFile + "\""){WorkingDirectory=app,UseShellExecute=false,CreateNoWindow=true};
   info.EnvironmentVariables["HOST"]="127.0.0.1";info.EnvironmentVariables["PORT"]="3001";info.EnvironmentVariables["NODE_ENV"]="production";info.EnvironmentVariables["LOCAL_TRIAL"]="true";
   var child=new Process{StartInfo=info};child.OutputDataReceived+=(s,e)=>{if(e.Data!=null)Log(e.Data);};child.ErrorDataReceived+=(s,e)=>{if(e.Data!=null)Log(e.Data);};child.Start();
   bool ready=false;var deadline=DateTime.UtcNow.AddSeconds(90);
   var elapsed=Stopwatch.StartNew();
   while(DateTime.UtcNow<deadline){
    string failure=StartupFailure(startupFile);if(failure!=null)throw new Exception(failure);
    if(await Healthy()){ready=true;break;}
    if(child.HasExited && child.ExitCode!=0)throw new Exception("Server gagal dimulai. Periksa runtime\\logs\\launcher-server.log.");
    status.Text="Menyiapkan aplikasi dan database lokal... "+(int)elapsed.Elapsed.TotalSeconds+" detik";
    await Task.Delay(300);
   }
   if(!ready)throw new Exception("Server belum siap setelah 90 detik. Periksa runtime\\logs\\launcher-server.log.");
  }
  var page=await http.GetAsync(Url);page.EnsureSuccessStatusCode();status.Text="Server aktif: "+BrowserUrl+"\nDatabase tersimpan di laptop.";Browser();
 }catch(Exception ex){status.Text=ex.Message;MessageBox.Show(this,ex.Message,"Server belum siap",MessageBoxButtons.OK,MessageBoxIcon.Warning);}finally{Busy(false);}}
 string Token(){foreach(string line in File.ReadAllLines(Path.Combine(app,".env"))){if(line.StartsWith("LOCAL_STOP_TOKEN="))return line.Substring(17).Trim().Trim('"','\'');}throw new Exception("Token penghentian lokal tidak tersedia.");}
 async Task StopServer(){if(busy)return;Busy(true);try{
  if(!await Healthy()){status.Text="Server Unboxin tidak terdeteksi. Tidak ada proses yang dihentikan.";return;}
  status.Text="Mencadangkan database sebelum menghentikan server...";Directory.CreateDirectory(backups);
  using(var client=new HttpClient(new HttpClientHandler{UseProxy=false})){
   client.Timeout=TimeSpan.FromMinutes(2);client.DefaultRequestHeaders.Add("x-local-stop-token",Token());
   var r=await client.GetAsync(Url+"api/local/backup");r.EnsureSuccessStatusCode();byte[] bytes=await r.Content.ReadAsByteArrayAsync();if(bytes.Length==0)throw new Exception("Backup kosong; server tidak dihentikan.");
   File.WriteAllBytes(Path.Combine(backups,DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss-fff")+".tar.gz"),bytes);
   status.Text="Backup tersimpan. Menghentikan server...";var stopped=await client.PostAsync(Url+"api/local/stop",new StringContent(""));stopped.EnsureSuccessStatusCode();
  }
  await Task.Delay(1500);if(await Healthy())throw new Exception("Server masih aktif. Tunggu beberapa saat lalu coba lagi.");
  status.Text="Server dihentikan. Backup ada di runtime\\backups.\nVideo tidak termasuk backup database.";
 }catch(Exception ex){status.Text=ex.Message;MessageBox.Show(this,ex.Message,"Penghentian belum selesai",MessageBoxButtons.OK,MessageBoxIcon.Warning);}finally{Busy(false);}}
}
