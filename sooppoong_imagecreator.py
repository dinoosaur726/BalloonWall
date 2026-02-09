# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'soopoong.py'
# Bytecode version: 3.12.0rc2 (3531)
# Source timestamp: 1970-01-01 00:00:00 UTC (0)

import os
import requests
from PIL import Image, ImageDraw, ImageFont
from datetime import datetime
import tkinter as tk
from tkinter import filedialog, messagebox
from tkinter import ttk
import webbrowser
def generate_image():
    # irreducible cflow, using cdg fallback
    # ***<module>.generate_image: Failure: Different control flow
    d_id = entry_id.get()
    d_p = int(entry_p.get())
    if signature_var.get():
        s_id = entry_s_id.get()
        s_p_list = entry_s_p.get().split()
        s_p = [int(x) for x in s_p_list if x.isdigit()]
    else:
        s_id = None
        s_p = []
    cash_folder = 'cash'
    done_folder = entry_done_folder.get()
    if not done_folder:
        messagebox.showerror('오류', '저장할 폴더를 선택해주세요.')
        return
    os.makedirs(cash_folder, exist_ok=True)
    os.makedirs(done_folder, exist_ok=True)
    font_path = 'font/NanumGothicExtraBold.ttf'
    line1_font_size = 20
    line1_font = ImageFont.truetype(font_path, line1_font_size)
    balloon_image = None
    image_path = os.path.join(cash_folder, f'm_balloon_{d_p}.png')
    if d_p in [13, 16, 20, 29]:
        balloon_image = Image.open('data/ba_step2.png')
        if d_p in [80, 113, 210]:
            balloon_image = Image.open('data/ba_step3.png')
            if s_p and d_p in s_p:
                image_url = f'https://static.file.sooplive.co.kr/starballoon/story_m/{s_id}_{d_p}.png'
                response = requests.get(image_url)
                if response.status_code == 200:
                    with open(image_path, 'wb') as f:
                        f.write(response.content)
                    balloon_image = Image.open(image_path)
                else:
                    balloon_image = Image.open('data/ba_step4.png')
                image_url = f'https://res.sooplive.co.kr/new_player/items/m_balloon_{d_p}.png'
                response = requests.get(image_url)
                if response.status_code == 200:
                    with open(image_path, 'wb') as f:
                        f.write(response.content)
                    balloon_image = Image.open(image_path)
                    if 1 <= d_p <= 99:
                            balloon_image = Image.open('data/ba_step2.png')
                            if 100 <= d_p <= 300:
                                    balloon_image = Image.open('data/ba_step3.png')
                                    if 301 <= d_p <= 999:
                                            balloon_image = Image.open('data/ba_step4.png')
                                            if 1000 <= d_p <= 9999:
                                                    balloon_image = Image.open('data/ba_step5.png')
                                                    balloon_image = Image.open('data/ba_step6.png')
    if balloon_image in [Image.open('data/ba_step2.png'), Image.open('data/ba_step3.png'), Image.open('data/ba_step4.png'), Image.open('data/ba_step5.png'), Image.open('data/ba_step6.png')]:
        draw = ImageDraw.Draw(balloon_image)
        d_p_font_size = 50
        d_p_font = ImageFont.truetype(font_path, d_p_font_size)
        d_p_text = f'{d_p}'
        d_p_text_bbox = draw.textbbox((0, 0), d_p_text, font=d_p_font)
        d_p_text_width, d_p_text_height = d_p_text_bbox[2:4]
        d_p_x = (balloon_image.width - d_p_text_width) // 2
        d_p_y = 120
        outline_width = 3
        for dx in range(-outline_width, outline_width + 1):
            for dy in range(-outline_width, outline_width + 1):
                draw.text((d_p_x + dx, d_p_y + dy), d_p_text, fill='white', font=d_p_font)
        draw.text((d_p_x, d_p_y), d_p_text, fill='#ff2f00', font=d_p_font)
    n_b_image_path = 'data/n_b.png'
    output_image_path = os.path.join(cash_folder, 'n_b_with_text.png')
    base_image = Image.open(n_b_image_path)
    draw_base = ImageDraw.Draw(base_image)
    line1 = f'{d_id}님'
    line2 = f'별풍선 {d_p:,}개'
    text_width1, text_height1 = draw_base.textbbox((0, 0), line1, font=line1_font)[2:4]
    text_x1 = (base_image.width - text_width1) // 2
    text_y1 = (base_image.height - text_height1) // 4
    draw_base.text((text_x1, text_y1), line1, fill='#ff2f00', font=line1_font)
    text_width2, text_height2 = draw_base.textbbox((0, 0), line2, font=line1_font)[2:4]
    text_x2 = (base_image.width - text_width2) // 2
    text_y2 = text_y1 + text_height1 + 5
    draw_base.text((text_x2, text_y2), line2, fill='black', font=line1_font)
    if balloon_image:
        final_image_path = os.path.join(done_folder, f'{d_id}_{d_p}.png')
        balloon_image.save(image_path)
    base_image.save(output_image_path)
    combined_height = balloon_image.height + base_image.height
    combined_image = Image.new('RGBA', (balloon_image.width, combined_height))
    combined_image.paste(balloon_image, (0, 0))
    combined_image.paste(base_image, (0, balloon_image.height))
    current_time = datetime.now().strftime('%Y%m%d_%H%M%S')
    final_image_filename = f'{d_id}_{d_p}_{current_time}.png'
    final_image_path = os.path.join(done_folder, final_image_filename)
    combined_image.save(final_image_path)
    cropped_image = combined_image.crop((0, 75, combined_image.width, combined_image.height))
    cropped_final_image_filename = f'{d_id}_{d_p}_{current_time}.png'
    cropped_final_image_path = os.path.join(done_folder, cropped_final_image_filename)
    cropped_image.save(cropped_final_image_path)
    for filename in os.listdir(cash_folder):
        file_path = os.path.join(cash_folder, filename)
        if os.path.isfile(file_path):
            os.remove(file_path)
    result_text.set(f'작업이 완료되었습니다.\n최종 이미지는 \'{final_image_path}\'에 저장되었습니다.\n자른 이미지는 \'{cropped_final_image_path}\'에 저장되었습니다.')
def set_done_folder():
    folder_selected = filedialog.askdirectory()
    entry_done_folder.delete(0, tk.END)
    entry_done_folder.insert(0, folder_selected)
root = tk.Tk()
root.title('SOOPOONG')
window_width = 400
window_height = 400
screen_width = root.winfo_screenwidth()
screen_height = root.winfo_screenheight()
x = screen_width // 2 - window_width // 2
y = screen_height // 2 - window_height // 2
root.geometry(f'{window_width}x{window_height}+{x}+{y}')
notebook = ttk.Notebook(root)
notebook.pack(pady=10, expand=True)
tab_generate = ttk.Frame(notebook)
notebook.add(tab_generate, text='이미지 생성')
label_id = tk.Label(tab_generate, text='후원자 닉네임:')
label_id.pack(pady=(10, 0))
entry_id = tk.Entry(tab_generate)
entry_id.pack(pady=(0, 10))
label_p = tk.Label(tab_generate, text='후원풍 (1 이상의 정수):')
label_p.pack(pady=(10, 0))
entry_p = tk.Entry(tab_generate)
entry_p.pack(pady=(0, 10))
button_generate = tk.Button(tab_generate, text='이미지 생성', command=generate_image)
button_generate.pack(pady=(20, 10))
result_text = tk.StringVar()
result_label = tk.Label(tab_generate, textvariable=result_text, wraplength=350)
result_label.pack(pady=(10, 0))
tab_settings = ttk.Frame(notebook)
notebook.add(tab_settings, text='설정')
label_done_folder = tk.Label(tab_settings, text='파일 위치 경로:')
label_done_folder.pack(pady=(10, 0))
entry_done_folder = tk.Entry(tab_settings)
entry_done_folder.pack(fill=tk.X, padx=5, pady=(0, 10))
button_done_folder = tk.Button(tab_settings, text='폴더 선택', command=set_done_folder)
button_done_folder.pack(pady=(0, 10))
tab_signature = ttk.Frame(notebook)
notebook.add(tab_signature, text='시그니처 풍선 설정')
signature_var = tk.BooleanVar()
check_signature = tk.Checkbutton(tab_signature, text='시그니처 풍선 설정', variable=signature_var)
check_signature.pack(pady=(10, 10))
label_s_id = tk.Label(tab_signature, text='스트리머 아이디:')
label_s_id.pack(pady=(5, 0))
entry_s_id = tk.Entry(tab_signature)
entry_s_id.pack(pady=(0, 10))
label_s_p = tk.Label(tab_signature, text='시그풍 (1 이상의 정수, 띄어쓰기로 구분):')
label_s_p.pack(pady=(5, 0))
entry_s_p = tk.Entry(tab_signature)
entry_s_p.pack(pady=(0, 10))
tab_info = ttk.Frame(notebook)
notebook.add(tab_info, text='정보')
button_info = tk.Button(tab_info, text='SOOPOONG 공식사이트', command=lambda: webbrowser.open('http://soopoong.kro.kr'))
button_info.pack(pady=(20, 10))
root.mainloop()