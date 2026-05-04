import subprocess
import urllib.parse
import sys

def run_ios_shortcut_via_cli(shortcut_name, rsd_ip=None, rsd_port=None):
    """
    透過 subprocess 呼叫 pymobiledevice3 命令列來觸發捷徑
    """
    print(f"準備觸發捷徑: [{shortcut_name}]")
    
    # 1. 將捷徑名稱進行 URL 編碼 (確保中文或空白不會讓網址解析失敗)
    encoded_name = urllib.parse.quote(shortcut_name)
    target_url = "https://google.com" # f"shortcuts://run-shortcut?name={encoded_name}"
    
    # 2. 建構基礎指令列表
    cmd = ["pymobiledevice3", "webinspector", "launch", target_url]
    
    # 3. 如果是 iOS 17 以上，且有傳入 RSD 資訊，則補上參數
    if rsd_ip and rsd_port:
        cmd.extend(["--rsd", str(rsd_ip), str(rsd_port)])
        print(f"啟用 iOS 17+ 模式 (RSD: {rsd_ip}:{rsd_port})")
    
    # print(f"執行指令: {' '.join(cmd)}") # 若需要除錯可解開此行

    try:
        # 4. 呼叫子處理程序
        # capture_output=True: 攔截終端機的輸出文字，不會直接印在螢幕上
        # text=True: 將輸出從位元組轉為純文字字串
        # check=True: 如果指令執行失敗 (Return code != 0)，會直接拋出異常
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        print("✅ 捷徑觸發指令已成功送出！")
        
        # 如果需要看系統回傳了什麼，可以印出 result.stdout
        # print("系統回傳:", result.stdout.strip())
        return True

    except subprocess.CalledProcessError as e:
        print("❌ 執行失敗！")
        print(f"錯誤代碼: {e.returncode}")
        # e.stderr 會捕捉到紅色報錯字串，非常方便除錯
        print(f"錯誤訊息: {e.stderr.strip()}")
        return False
    except FileNotFoundError:
        print("❌ 找不到 pymobiledevice3 指令！請確認它是否已安裝並加入環境變數。")
        return False

# ================= 測試區塊 =================
if __name__ == "__main__":
    MY_SHORTCUT = "IncreaseSteps"
    
    # 若為 iOS 17+，請填入 start-quic-tunnel 取得的 IP 與 Port
    # 若為 iOS 16 (含) 以下，請將這兩個變數設為 None
    TUNNEL_IP = "fde5:4c3d:c396::1"  
    TUNNEL_PORT = "63532"    
    
    # 記得確保手機螢幕亮著，並且 Safari 開著一個正常的網頁 (如 google.com)
    success = run_ios_shortcut_via_cli(MY_SHORTCUT, TUNNEL_IP, TUNNEL_PORT)
    
    if success:
        print("流程執行完畢。")
    else:
        sys.exit(1)