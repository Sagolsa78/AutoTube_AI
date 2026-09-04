import subprocess
import os

def test():
    os.system("ffmpeg -f lavfi -i color=c=red:s=320x240:d=1 -c:v libx264 -y red.mp4")
    os.system("ffmpeg -f lavfi -i color=c=blue:s=320x240:d=1 -c:v libx264 -y blue.mp4")
    os.system("ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono:d=5 -c:a aac -y audio.m4a")
    
    cmd = [
        "ffmpeg", "-y",
        "-stream_loop", "-1", "-i", "red.mp4",
        "-stream_loop", "-1", "-i", "blue.mp4",
        "-i", "audio.m4a",
        "-filter_complex", "[0:v]trim=duration=3[v0];[1:v]trim=duration=3[v1];[v0][v1]xfade=transition=fade:duration=0.5:offset=2.5[out]",
        "-map", "[out]",
        "-map", "2:a",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-t", "5",
        "out.mp4"
    ]
    print("Running ffmpeg...")
    subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    print("Done")

test()
