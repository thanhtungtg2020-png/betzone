BETZONE v5 — BIG UPDATE
========================

Chạy:
1. Giải nén thư mục.
2. Mở index.html bằng Chrome/Edge.
3. Nếu trình duyệt chặn một số tính năng khi mở file trực tiếp, chạy server local:
   python -m http.server 8000
   rồi mở http://localhost:8000

V5 BIG UPDATE
--------------
- Tỷ lệ thắng của game cũ đổi từ x1.90 → x2.00.
- Vật phẩm: mỗi món mặc định chỉ được MUA 3 lần mỗi ngày.
- Khi đạt Level 40: giới hạn mua tăng thành 4 lần / món / ngày.
- Level tối đa: 99.
- XP tăng dần theo cấp; level sau luôn cần nhiều XP hơn level trước.
- Mỗi lần lên level: +2,000 coin ảo.
- Riêng Level 10: thưởng +20,000 coin ảo.
- Riêng Level 20: thưởng +30,000 coin ảo.
- Level 80: mở khóa skin độc quyền BETZONE Sovereign.
- Level 99: mở title đặc biệt “God of Casino”.
- Skin mới: Hoshino, Fern (fan-style/local fallback), cùng skin độc quyền Level 80.
- Thêm Sảnh Danh Hiệu: xem đã đạt/chưa đạt và trang bị title trực tiếp.
- Hồ sơ: chọn title đang dùng ngay trong popup “Thông tin cá nhân”.
- Thêm Pachinko / Slot Machine neon 3 reel, hoàn toàn bằng coin ảo.
- Voice trợ lý: ưu tiên voice tiếng Việt vi-VN; nếu máy có voice Microsoft/Google Vietnamese sẽ ưu tiên giọng đó. Chất lượng voice phụ thuộc voice package được cài trong Windows/Chrome.
- Logo mới dùng file logo.svg để dễ tự thay.

DANH SÁCH TITLE
---------------
CƠ BẢN:
- Người mới: mặc định.
- Có 50,000 tiền: số dư >= 50,000.
- Có 100,000 tiền: số dư >= 100,000.
- Cấp 10: Level >= 10.

BÌNH THƯỜNG:
- Thắng 3 trận liên tiếp: best win streak >= 3.
- Thua 5 trận liên tiếp: best loss streak >= 5.
- Huyền thoại: tổng số trận thắng >= 25.

HUYỀN THOẠI:
- Cấp 80: Level >= 80.
- Siêu bá khí: best win streak >= 10.
- Huyền Thần: tổng số trận thắng >= 50.

ĐẶC BIỆT:
- God of Casino: Level >= 99.

QUAN TRỌNG — NƠI TỰ THAY NỘI DUNG
----------------------------------
Xem file V5_CUSTOMIZE.txt để biết chính xác chỗ thay logo, skin Level 80, voice và tiêu chí title.

Toàn bộ coin vẫn là coin ảo/localStorage; không tích hợp tiền thật.


V5.1 — UPDATE
--------------
- Thêm Code quản trị trong Thông tin cá nhân: code `admin` đưa Level lên 99, mở skin Level 80 và title God of Casino.
- Thêm trợ lý mới trong shop: Mira Neon (`mira.png`).
- Skin nhân vật ưu tiên ảnh local: `rem.png`, `furina.png`, `hoshino.png`, `fern.png`, `bibi.png`, `mira.png`, `mup.jpg`; thiếu ảnh sẽ dùng SVG fallback.
- Thêm game Tiến Lên Miền Nam 4 người: BẠN + 3 máy, 52 lá, 13 lá/người, có lượt đánh/chặn/bỏ lượt, tứ quý, đôi thông và chặt 2 theo bộ luật lõi phổ biến.
- Bản Tiến Lên chỉ dùng coin ảo và có ghi rõ những phần luật thường biến thể theo từng bàn.


V6 BIG UPDATE
--------------
- Tiền hiển thị bằng 💵 thay cho emoji coin cũ.
- Ô tiền cược nhớ số tiền gần nhất để tăng tốc độ chơi.
- Tiến Lên 4P: AI ưu tiên Đơn → Đôi → Sảnh → Sám → Tứ → 3/4 đôi thông, trong từng nhóm đánh từ thấp lên cao.
- Bot hiển thị mặt sấp của bài và số lá còn lại.
- Bài người chơi được đưa lên cao hơn, dễ nhìn/chọn.
- Kết quả ván có màn hình Victory/Defeat/Draw; thắng vàng + 👑, thua đỏ + 🃏, hòa xám.
- Lucky Games tách thành Visual Showcase và Lucky Cabinet.
- Thêm BUCKSHOT ROULETTE local virtual-only.
- Rút coin: tối đa 80,000 💵 / 30 phút, tối thiểu 3,000 💵.
- Góc phải trên cùng có sự kiện JUJUTSU KAISEN.
- Gojo và Sukuna là skin trợ lý mới + event battle.
- Event Gojo vs Sukuna có HP, CE, cooldown, skill, Domain Clash, RCT, Black Flash, Ten Shadows, Mahoraga adaptation, Agito, World Cutting Slash, Binding Vow, AI và Battle Log.


V6.3 — BUCKSHOT VISIBILITY FIX
-------------------------------
- Đưa nút Buckshot Roulette lên ngay sau Mini Games để dễ nhìn thấy.
- Sidebar hỗ trợ cuộn dọc, không còn cắt mất các mục ở màn hình thấp.
- Làm nổi bật nút Buckshot bằng tông đỏ.
- Game Buckshot nằm ở section id=buckshot; bấm nút menu để mở, hoặc bấm thẻ Buckshot trong Lucky Games.

V6.4 — BUCKSHOT GAMEPLAY UPDATE
- Hiển thị số đạn thật/đạn giả còn lại và số vòng hiện tại.
- Số viên đạn tăng theo vòng: 4, 5, 6, 7, tối đa 8 viên; thành phần đạn thật/giả được xáo trộn.
- Khẩu súng xoay theo mục tiêu/lượt; có hiệu ứng giật súng và lóe sáng khi bắn đạn thật.
- Âm thanh bắn thật và tiếng tách của đạn giả được tổng hợp ngay trong trình duyệt, không cần tải file âm thanh.
- Chỉ là mô phỏng coin ảo/offline; âm thanh có thể bị trình duyệt chặn cho tới khi người chơi tương tác lần đầu.
