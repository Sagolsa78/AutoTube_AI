import sqlite3
import json

conn = sqlite3.connect('storage/autoshorts.db')
c = conn.cursor()

try:
    c.execute("ALTER TABLE user_profiles ADD COLUMN default_voice_id VARCHAR DEFAULT 'en-US-ChristopherNeural'")
    c.execute("ALTER TABLE user_profiles ADD COLUMN content_tone VARCHAR DEFAULT 'casual'")
    c.execute("ALTER TABLE user_profiles ADD COLUMN niche_keywords JSON DEFAULT '[]'")
    c.execute("ALTER TABLE user_profiles ADD COLUMN title_style_preference VARCHAR DEFAULT 'curiosity'")
    c.execute("ALTER TABLE user_profiles ADD COLUMN hashtag_set JSON DEFAULT '[\"shorts\", \"viral\"]'")
    c.execute("ALTER TABLE user_profiles ADD COLUMN auto_approve BOOLEAN DEFAULT 0")
except Exception as e:
    print(f"Profile err: {e}")

try:
    c.execute("ALTER TABLE videos ADD COLUMN title_candidates JSON DEFAULT '[]'")
    c.execute("ALTER TABLE videos ADD COLUMN selected_title VARCHAR")
    c.execute("ALTER TABLE videos ADD COLUMN description TEXT")
    c.execute("ALTER TABLE videos ADD COLUMN hashtags JSON DEFAULT '[]'")
    c.execute("ALTER TABLE videos ADD COLUMN voice_override VARCHAR")
except Exception as e:
    print(f"Video err: {e}")

conn.commit()
conn.close()
print("DB altered")
