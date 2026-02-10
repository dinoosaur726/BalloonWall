# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'SOOPOONG Ver. 1.5.py'
# Bytecode version: 3.12.0rc2 (3531)
# Source timestamp: 1970-01-01 00:00:00 UTC (0)

global done_folder
import os
import requests
from PIL import Image, ImageDraw, ImageFont
from datetime import datetime
import tkinter as tk
from tkinter import filedialog, messagebox
from tkinter import ttk
import webbrowser
import json
DATA_FOLDER = 'data'
os.makedirs(DATA_FOLDER, exist_ok=True)
CONFIG_FILE = os.path.join(DATA_FOLDER, 'config.json')
def load_config():
    # irreducible cflow, using cdg fallback
    # ***<module>.load_config: Failure: Compilation Error
    config = {'done_folder': None}
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        config.update(json.load(f))
                return config
                except (FileNotFoundError, json.JSONDecodeError):
                        pass
def save_config(config):
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=4, ensure_ascii=False)
done_folder = None
def select_save_folder():
    global done_folder
    folder_selected = filedialog.askdirectory()
    if folder_selected:
        done_folder = folder_selected
        save_path_label.config(text=f'저장 경로: {done_folder}')
def generate_image_balloon(d_id, d_p, s_id=None, s_p=None, is_signature=False):
    # irreducible cflow, using cdg fallback
    # ***<module>.generate_image_balloon: Failure: Different control flow
    cash_folder = 'cash'
    if not done_folder:
        messagebox.showerror('오류', '저장할 폴더를 선택해주세요.')
        return
    os.makedirs(cash_folder, exist_ok=True)
    os.makedirs(done_folder, exist_ok=True)
    font_path = 'font/NanumGothicExtraBold.ttf'
    try:
        line1_font = ImageFont.truetype(font_path, 20)
        d_p_font = ImageFont.truetype(font_path, 50)
    except OSError:
        messagebox.showerror('오류', '폰트 파일을 찾을 수 없습니다.')
        return None
    balloon_image = None
    image_path = os.path.join(cash_folder, f'm_balloon_{d_p}.png')
    if d_p in [13, 16, 20, 29]:
        balloon_image = Image.open('data/ba_step2.png')
        if d_p in [80, 113, 210]:
            balloon_image = Image.open('data/ba_step3.png')
            if is_signature and s_id and s_p and (d_p in s_p):
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
    base_image = Image.open(n_b_image_path)
    draw_base = ImageDraw.Draw(base_image)
    text_width1, text_height1 = draw_base.textbbox((0, 0), f'{d_id}님', font=line1_font)[2:4]
    text_x1 = (base_image.width - text_width1) // 2
    text_y1 = (base_image.height - text_height1) // 4
    draw_base.text((text_x1, text_y1), f'{d_id}님', fill='#ff2f00', font=line1_font)
    text_width2, text_height2 = draw_base.textbbox((0, 0), f'별풍선 {d_p:,}개', font=line1_font)[2:4]
    text_x2 = (base_image.width - text_width2) // 2
    text_y2 = text_y1 + text_height1 + 5
    draw_base.text((text_x2, text_y2), f'별풍선 {d_p:,}개', fill='black', font=line1_font)
    return (balloon_image, base_image, image_path)
def generate_image_adballoon(d_id, d_p):
    cash_folder = 'cash'
    if not done_folder:
        messagebox.showerror('오류', '저장할 폴더를 선택해주세요.')
        return
    else:
        os.makedirs(cash_folder, exist_ok=True)
        os.makedirs(done_folder, exist_ok=True)
        font_path = 'font/NanumGothicExtraBold.ttf'
        try:
            line1_font = ImageFont.truetype(font_path, 20)
            d_p_font = ImageFont.truetype(font_path, 50)
        except OSError:
            messagebox.showerror('오류', '폰트 파일을 찾을 수 없습니다.')
            return None
        balloon_image = Image.open('data/ad.png')
        base_image = Image.open('data/n_b_ad.png')
        draw_base = ImageDraw.Draw(base_image)
        text_width1, text_height1 = draw_base.textbbox((0, 0), f'{d_id}님', font=line1_font)[2:4]
        text_x1 = (base_image.width - text_width1) // 2
        text_y1 = (base_image.height - text_height1) // 4
        draw_base.text((text_x1, text_y1), f'{d_id}님', fill='white', font=line1_font)
        text_width2, text_height2 = draw_base.textbbox((0, 0), f'애드벌룬 {d_p:,}개', font=line1_font)[2:4]
        text_x2 = (base_image.width - text_width2) // 2
        text_y2 = text_y1 + text_height1 + 5
        draw_base.text((text_x2, text_y2), f'애드벌룬 {d_p:,}개', fill='#28e3b8', font=line1_font)
        return (balloon_image, base_image)
def process_image(balloon_image, base_image, d_id, d_p, is_adballoon=False, image_path=None):
    if not balloon_image or not base_image:
        return None
    else:
        current_time = datetime.now().strftime('%Y%m%d_%H%M%S')
        if is_adballoon:
            final_image_filename = f'AD_{d_id}_{d_p}_{current_time}.png'
        else:
            final_image_filename = f'{d_id}_{d_p}_{current_time}.png'
        final_image_path = os.path.join(done_folder, final_image_filename)
        if image_path and os.path.exists(image_path):
                balloon_image.save(image_path)
        combined_height = balloon_image.height + base_image.height
        combined_image = Image.new('RGBA', (balloon_image.width, combined_height))
        combined_image.paste(balloon_image, (0, 0))
        combined_image.paste(base_image, (0, balloon_image.height))
        combined_image.save(final_image_path)
        cropped_image = combined_image.crop((0, 75, combined_image.width, combined_image.height))
        if is_adballoon:
            cropped_final_image_filename = f'AD_{d_id}_{d_p}_{current_time}.png'
        else:
            cropped_final_image_filename = f'{d_id}_{d_p}_{current_time}.png'
        cropped_final_image_path = os.path.join(done_folder, cropped_final_image_filename)
        cropped_image.save(cropped_final_image_path)
        cash_folder = 'cash'
        for filename in os.listdir(cash_folder):
            file_path = os.path.join(cash_folder, filename)
            if os.path.isfile(file_path):
                os.remove(file_path)
        return (final_image_path, cropped_final_image_path)
def generate_balloon_image():
    d_id = entry_id_balloon.get()
    d_p = int(entry_p_balloon.get())
    if signature_var.get():
        s_id = entry_s_id.get()
        s_p_list = entry_s_p.get().split()
        s_p = [int(x) for x in s_p_list if x.isdigit()]
    else:
        s_id = None
        s_p = []
    balloon_image, base_image, image_path = generate_image_balloon(d_id, d_p, s_id, s_p, signature_var.get())
    if not balloon_image or not base_image:
        return None
    else:
        final_image_path, cropped_final_image_path = process_image(balloon_image, base_image, d_id, d_p, image_path=image_path)
        if final_image_path:
            result_text.set(f'작업이 완료되었습니다.\n최종 이미지는 \'{final_image_path}\'에 저장되었습니다.\n자른 이미지는 \'{cropped_final_image_path}\'에 저장되었습니다.')
            if signature_var.get():
                config = {'done_folder': done_folder}
                save_config(config)
def generate_adballoon_image():
    d_id = entry_id_adballoon.get()
    d_p = int(entry_p_adballoon.get())
    balloon_image, base_image = generate_image_adballoon(d_id, d_p)
    if not balloon_image or not base_image:
        return None
    else:
        final_image_path, cropped_final_image_path = process_image(balloon_image, base_image, d_id, d_p, is_adballoon=True)
        if final_image_path:
            result_text.set(f'작업이 완료되었습니다.\n최종 이미지는 \'{final_image_path}\'에 저장되었습니다.\n자른 이미지는 \'{cropped_final_image_path}\'에 저장되었습니다.')
def toggle_signature():
    if signature_var.get():
        entry_s_id.config(state='normal')
        entry_s_p.config(state='normal')
    else:
        entry_s_id.config(state='disabled')
        entry_s_p.config(state='disabled')
root = tk.Tk()
root.title('SOOPOONG Ver. 1.5')
root.geometry('300x570')
root.resizable(False, False)
def center_window(window):
    window.update_idletasks()
    width = window.winfo_width()
    height = window.winfo_height()
    x = window.winfo_screenwidth() // 2 - width // 2
    y = window.winfo_screenheight() // 2 - height // 2
    window.geometry(f'{width}x{height}+{x}+{y}')
root.after(10, lambda: center_window(root))
style = ttk.Style()
style.theme_use('clam')
font_path = 'font/NanumGothicExtraBold.ttf'
try:
    default_font = (font_path, 10)
    label_font = (font_path, 10, 'bold')
    button_font = (font_path, 10, 'bold')
    entry_font = (font_path, 10)
except OSError:
    messagebox.showerror('오류', '폰트 파일을 찾을 수 없습니다.')
    default_font = ('Arial', 10)
    label_font = ('Arial', 10, 'bold')
    button_font = ('Arial', 10, 'bold')
    entry_font = ('Arial', 10)
style.configure('TFrame', background='#f0f0f0')
style.configure('TLabel', background='#f0f0f0', foreground='#333333', font=label_font, anchor='center')
style.configure('TEntry', fieldbackground='white', foreground='#333333', font=entry_font, padding=5)
style.configure('TButton', background='#2196F3', foreground='white', relief='flat', font=button_font, padding=8, focuscolor='!focus', borderwidth=0)
button_soopoong = ttk.Button(root, text='SOOPOONG 공식 사이트', command=lambda: webbrowser.open('http://soopoong.kro.kr'), style='TButton')
button_soopoong.pack(pady=(10, 0), padx=10, fill='x')
button_soopoong.config(width=36)
save_path_label = ttk.Label(root, text='저장 경로:  (설정 필요)', style='TLabel')
save_path_label.pack(pady=(5, 0), padx=10, fill='x')
button_change_folder = ttk.Button(root, text='저장경로 설정', command=select_save_folder, style='TButton')
button_change_folder.pack(pady=(5, 0), padx=10, fill='x')
separator1 = ttk.Separator(root, orient='horizontal')
separator1.pack(fill='x', padx=10, pady=5)
notebook = ttk.Notebook(root)
notebook.pack(pady=5, padx=10, fill='both', expand=True)
balloon_tab = ttk.Frame(notebook, style='TFrame')
notebook.add(balloon_tab, text='별풍선')
signature_frame = ttk.Frame(balloon_tab, style='TFrame')
signature_frame.pack(pady=5, padx=10)
signature_var = tk.BooleanVar(value=False)
def on_off_button_clicked():
    signature_var.set(not signature_var.get())
    toggle_signature()
on_off_button = ttk.Button(signature_frame, text='OFF', command=on_off_button_clicked, style='TButton')
on_off_button.pack(pady=5)
label_s_id = ttk.Label(signature_frame, text='스트리머 아이디:', style='TLabel')
label_s_id.pack(pady=(5, 0))
entry_s_id = ttk.Entry(signature_frame, font=entry_font)
entry_s_id.pack(fill='x', padx=10, pady=(0, 5))
entry_s_id.config(state='disabled')
label_s_p = ttk.Label(signature_frame, text='시그풍 (1 이상의 정수, 띄어쓰기로 구분):', style='TLabel')
label_s_p.pack(pady=(5, 0))
entry_s_p = ttk.Entry(signature_frame, font=entry_font)
entry_s_p.pack(fill='x', padx=10, pady=(0, 5))
entry_s_p.config(state='disabled')
def update_button_text(*args):
    if signature_var.get():
        on_off_button.config(text='ON')
    else:
        on_off_button.config(text='OFF')
signature_var.trace('w', update_button_text)
donation_frame_balloon = ttk.Frame(balloon_tab, style='TFrame')
donation_frame_balloon.pack(pady=5, padx=10, fill='x')
label_id_balloon = ttk.Label(donation_frame_balloon, text='후원자 닉네임:', style='TLabel')
label_id_balloon.pack(pady=(5, 0))
entry_id_balloon = ttk.Entry(donation_frame_balloon, font=entry_font)
entry_id_balloon.pack(fill='x', padx=10, pady=(0, 5))
label_p_balloon = ttk.Label(donation_frame_balloon, text='후원풍 (1 이상의 정수):', style='TLabel')
label_p_balloon.pack(pady=(5, 0))
entry_p_balloon = ttk.Entry(donation_frame_balloon, font=entry_font)
entry_p_balloon.pack(fill='x', padx=10, pady=(0, 5))
button_generate_balloon = ttk.Button(balloon_tab, text='이미지 생성', command=generate_balloon_image, style='TButton')
button_generate_balloon.pack(pady=15)
adballoon_tab = ttk.Frame(notebook, style='TFrame')
notebook.add(adballoon_tab, text='애드벌룬')
donation_frame_adballoon = ttk.Frame(adballoon_tab, style='TFrame')
donation_frame_adballoon.pack(pady=5, padx=10, fill='x')
label_id_adballoon = ttk.Label(donation_frame_adballoon, text='후원자 닉네임:', style='TLabel')
label_id_adballoon.pack(pady=(5, 0))
entry_id_adballoon = ttk.Entry(donation_frame_adballoon, font=entry_font)
entry_id_adballoon.pack(fill='x', padx=10, pady=(0, 5))
label_p_adballoon = ttk.Label(donation_frame_adballoon, text='애드벌룬 (1 이상의 정수):', style='TLabel')
label_p_adballoon.pack(pady=(5, 0))
entry_p_adballoon = ttk.Entry(donation_frame_adballoon, font=entry_font)
entry_p_adballoon.pack(fill='x', padx=10, pady=(0, 5))
button_generate_adballoon = ttk.Button(adballoon_tab, text='이미지 생성', command=generate_adballoon_image, style='TButton')
button_generate_adballoon.pack(pady=15)
result_text = tk.StringVar()
result_label = ttk.Label(root, textvariable=result_text, wraplength=280, font=default_font, style='TLabel')
result_label.pack(pady=(10, 0), padx=10)
config = load_config()
done_folder = config.get('done_folder')
if done_folder:
    save_path_label.config(text=f'저장 경로: {done_folder}')
def on_closing():
    config = {'done_folder': done_folder}
    save_config(config)
    root.destroy()
root.protocol('WM_DELETE_WINDOW', on_closing)
root.mainloop()