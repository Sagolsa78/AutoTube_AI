import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

try:
    try:
        cur.execute("ALTER TYPE ideastatus ADD VALUE 'promoted';")
    except Exception as e: print("Already exists?", e)
    
    try:
        cur.execute("ALTER TYPE ideastatus ADD VALUE 'discarded';")
    except Exception as e: print("Already exists?", e)
    
    # scriptstatus might be completely new
    try:
        cur.execute("CREATE TYPE scriptstatus AS ENUM ('draft', 'discarded', 'used_in_render');")
    except Exception as e: print("Already exists?", e)
    
    cur.execute("UPDATE ideas SET status = 'promoted' WHERE status = 'scripted'")
    cur.execute("UPDATE ideas SET status = 'discarded' WHERE status IN ('rejected', 'approved')")
    print("Migrated successfully")
except Exception as e:
    print(f"Error: {e}")
finally:
    cur.close()
    conn.close()
