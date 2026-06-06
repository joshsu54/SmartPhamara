import urllib.request
import json
import os

# 目標：獲取法定傳染病（如：登革熱、HIV、COVID-19、腸病毒重症）的資料
# 資料來源：政府開放平台 (Taiwan CDC Open Data)

DATASETS = [
    # 061: 登革熱
    {"url": "https://od.cdc.gov.tw/eic/Age_County_Gender_061.json", "name": "登革熱"},
    # 044: HIV
    {"url": "https://od.cdc.gov.tw/eic/Weekly_Age_County_Gender_044.json", "name": "HIV"},
    # 0749: 腸病毒重症
    {"url": "https://od.cdc.gov.tw/eic/Age_County_Gender_0749.json", "name": "腸病毒感染併發重症"}
]

SQL_FILE = "nidss_data.sql"

def fetch_data(url):
    print(f"正在抓取資料: {url}")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            # 處理可能帶有 BOM 的 UTF-8
            raw_data = response.read().decode('utf-8-sig')
            return json.loads(raw_data)
    except Exception as e:
        print(f"抓取失敗: {url}, 錯誤: {e}")
        return []

def generate_sql():
    with open(SQL_FILE, 'w', encoding='utf-8') as f:
        f.write("-- NIDSS 法定傳染病爬蟲產生的 SQL 檔\n")
        f.write("USE smart_pharma_db;\n\n")
        
        for dataset in DATASETS:
            data = fetch_data(dataset["url"])
            if not data:
                continue
                
            print(f"[{dataset['name']}] 總計 {len(data)} 筆資料，正在生成 SQL...")
            
            # 為了避免檔案過大，我們只取最近的 100 筆作為示範 (可以自行修改)
            sample_data = data[-100:] if len(data) > 100 else data
            
            for item in sample_data:
                # 判斷欄位名稱 (不同資料集可能有微小差異)
                disease_name = item.get("確定病名", dataset["name"])
                report_year = item.get("發病年份", item.get("診斷年份", "0"))
                report_week = item.get("發病週別", item.get("診斷週別", "0"))
                report_month = item.get("發病月份", "0")
                county = item.get("縣市", "未知")
                gender = item.get("性別", "")
                age_group = item.get("年齡層", "")
                cases = item.get("確定病例數", "0")
                
                # 清理字串中的單引號，防止 SQL Injection
                disease_name = disease_name.replace("'", "''")
                county = county.replace("'", "''")
                gender = gender.replace("'", "''")
                age_group = age_group.replace("'", "''")
                
                sql = f"INSERT INTO infectious_diseases_stats " \
                      f"(disease_name, report_year, report_week, report_month, county, gender, age_group, cases) " \
                      f"VALUES ('{disease_name}', {report_year}, {report_week}, {report_month}, '{county}', '{gender}', '{age_group}', {cases});\n"
                f.write(sql)
                
    print(f"\n✅ 爬蟲執行完畢！SQL 指令已儲存至 {SQL_FILE}")
    print("您可以透過 MySQL 客戶端匯入此檔案，例如： mysql -u root -p smart_pharma_db < nidss_data.sql")

if __name__ == "__main__":
    generate_sql()
