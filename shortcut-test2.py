import subprocess
import urllib.parse
import sys

def run_visual_debugger(shortcut_name, rsd_ip, rsd_port):
    print("🚀 發射「黃色畫面」視覺除錯彈...")
    
    # 捷徑 URL (使用你已經改好英文的 Test)
    shortcut_url = f"shortcuts://run-shortcut?name={shortcut_name}"
    
    # 網頁 Payload：黃色背景 + 巨大實體按鈕 + 三重自動跳轉攻擊
    html_payload = f"""
    <!DOCTYPE html>
    <html>
    <body style="background-color: yellow; text-align: center; padding-top: 100px; font-family: sans-serif;">
        <h1 style="font-size: 50px;">如果沒有自動跳轉<br>請手動點下方按鈕</h1>
        <br><br>
        <a id="btn" href="{shortcut_url}" style="font-size: 80px; background: blue; color: white; padding: 40px; border-radius: 20px; text-decoration: none;">點我執行捷徑</a>
        
        <script>
            setTimeout(function(){{
                // 招式 1: iframe 隱形注入
                var ifr = document.createElement('iframe');
                ifr.src = '{shortcut_url}';
                ifr.style.display = 'none';
                document.body.appendChild(ifr);
                
                // 招式 2: 直接改寫 location
                window.location.href = '{shortcut_url}';
                
                // 招式 3: JS 模擬點擊
                document.getElementById('btn').click();
            }}, 800);
        </script>
    </body>
    </html>
    """
    
    # 將 HTML 轉為 Data URI 格式
    data_uri = f"data:text/html;charset=utf-8,{urllib.parse.quote(html_payload)}"
    
    cmd = ["pymobiledevice3", "webinspector", "launch", data_uri]
    if rsd_ip and rsd_port:
        cmd.extend(["--rsd", str(rsd_ip), str(rsd_port)])
        
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        print("✅ 網頁已送出，請盯著手機畫面！")
    except subprocess.CalledProcessError as e:
        print(f"❌ 執行失敗！錯誤訊息: {e.stderr.strip()}")

# 執行測試 (記得換成你的 RSD Port)
run_visual_debugger("IncreaseSteps", "fde5:4c3d:c396::1", "63532")