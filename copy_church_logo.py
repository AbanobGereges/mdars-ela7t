import os
import shutil

src = r"C:\Users\pc\.gemini\antigravity\brain\065a5bc4-63f7-4ccc-a9fb-bda6d9d5ab16\.user_uploaded\media_1788379279255.jpg"
curr_dir = os.path.dirname(os.path.abspath(__file__))

targets = [
    os.path.join(curr_dir, "church-logo.jpg"),
    os.path.join(curr_dir, "public", "church-logo.jpg"),
    os.path.join(curr_dir, "apple-touch-icon.png")
]

for target in targets:
    try:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copyfile(src, target)
        print(f"[✓] Copied church logo to: {target}")
    except Exception as e:
        print(f"[!] Error copying to {target}: {e}")

print("\nDone! All logo files updated successfully.")
