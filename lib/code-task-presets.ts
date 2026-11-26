import { filesToCodeBundle } from "@/lib/code-grader";
import type { CodeBundle, CodeCriterion } from "@/lib/code-task-types";

export type CodeTaskPreset = {
  id: string;
  label: string;
  category: string;
  difficulty: string;
  title: string;
  description: string;
  passThreshold: number;
  starterCode: CodeBundle;
  solutionCode: CodeBundle;
  criteria: CodeCriterion[];
};

function makeJsConsoleFiles(starterOrSolJs: string, title: string): CodeBundle {
  return filesToCodeBundle([
    { id: "file_js", name: "script.js", language: "js", content: starterOrSolJs },
    {
      id: "file_html",
      name: "index.html",
      language: "html",
      content: `<!DOCTYPE html>\n<html lang="vi">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${title}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="exercise-card">\n    <h2>${title}</h2>\n    <p>Viết mã JavaScript trong file <strong>script.js</strong> và bấm <strong>Run Code</strong> để xem kết quả ở khung <strong>Console</strong> bên dưới.</p>\n  </div>\n  <script src="script.js"></script>\n</body>\n</html>`,
    },
    {
      id: "file_css",
      name: "style.css",
      language: "css",
      content: `/* Style đơn giản cho khung hướng dẫn bài tập */\nbody {\n  font-family: Arial, sans-serif;\n  padding: 24px;\n  background: #f8fafc;\n  color: #0f172a;\n}\n\n.exercise-card {\n  background: #ffffff;\n  border: 1px solid #cbd5e1;\n  border-radius: 10px;\n  padding: 20px;\n  max-width: 520px;\n  margin: auto;\n}\n\n.exercise-card h2 {\n  margin-top: 0;\n  color: #1d4ed8;\n}\n\n.exercise-card p {\n  margin-bottom: 0;\n  color: #475569;\n}\n`,
    },
  ]);
}

function makeWeb3Files(html: string, css: string, js: string): CodeBundle {
  return filesToCodeBundle([
    { id: "file_html", name: "index.html", language: "html", content: html },
    { id: "file_css", name: "style.css", language: "css", content: css },
    { id: "file_js", name: "script.js", language: "js", content: js },
  ]);
}

function makeWebStarter(title: string, bodyHint: string, cssComment: string, jsComment: string): CodeBundle {
  return makeWeb3Files(
    `<!DOCTYPE html>\n<html lang="vi">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${title}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <!-- ${bodyHint} -->\n  <div class="container">\n    <h1>${title}</h1>\n  </div>\n  <script src="script.js"></script>\n</body>\n</html>`,
    `/* ${cssComment} */\nbody {\n  font-family: Arial, sans-serif;\n  margin: 0;\n  padding: 24px;\n  background: #f8fafc;\n}\n`,
    `// ${jsComment}\n`,
  );
}

const COMMON_RULES =
  "\n\nQuy định chung:\n" +
  "- Chỉ sử dụng kiến thức cơ bản: var, let, const, String, Number, Boolean, typeof, console.log.\n" +
  "- Chưa sử dụng if/else, vòng lặp, mảng, hàm hoặc DOM.\n" +
  "- Kết quả phải in ra Console (console.log). Không bắt buộc đặt tên biến giống đáp án mẫu.";

const COMMON_OPERATOR_RULES =
  "\n\nQuy định chung:\n" +
  "- Chỉ sử dụng kiến thức cơ bản + các nhóm toán tử (số học, so sánh, so sánh bằng, logic) và console.log.\n" +
  "- Chưa sử dụng if/else, vòng lặp, mảng, hàm hoặc DOM.\n" +
  "- Kết quả phải hiển thị trong Console. Không bắt buộc đặt tên biến giống đáp án mẫu.";

const COMMON_CONDITIONAL_RULES =
  "\n\nQuy định chung:\n" +
  "- Chỉ sử dụng kiến thức từ bài 01 đến bài 04 (biến, kiểu dữ liệu, toán tử, if/else if/else, switch/case/default) và console.log().\n" +
  "- Chưa sử dụng vòng lặp, mảng, hàm hoặc DOM.\n" +
  "- Không yêu cầu đặt tên biến giống đáp án mẫu.";

const COMMON_LOOP_RULES =
  "\n\nQuy định chung:\n" +
  "- Chỉ sử dụng kiến thức từ bài 01 đến bài 05 (biến, kiểu dữ liệu, toán tử, if/else/switch, vòng lặp for, while, do...while) và console.log().\n" +
  "- Chưa sử dụng mảng, hàm hoặc DOM.\n" +
  "- Không viết thủ công từng kết quả mà phải sử dụng vòng lặp để xử lý. Không yêu cầu đặt tên biến giống đáp án mẫu.";

const COMMON_FN_ARR_OBJ_RULES =
  "\n\nQuy định chung:\n" +
  "- Được sử dụng kiến thức của các bài trước đó.\n" +
  "- Không bắt buộc đặt tên biến, hàm hoặc phương thức giống đáp án.\n" +
  "- Được phép triển khai bằng nhiều cách khác nhau nếu đáp ứng đúng yêu cầu và in kết quả rõ ràng ra Console.";

const COMMON_DOM_RULES =
  "\n\nQuy định chung:\n" +
  "- Yêu cầu sử dụng đủ 3 file: index.html, style.css, script.js.\n" +
  "- Giao diện HTML/CSS phải hiển thị thực tế và xử lý tương tác bằng DOM/Sự kiện trong script.js.\n" +
  "- Không bắt buộc đặt tên id, class, biến hay hàm giống đáp án mẫu; hệ thống chấm dựa trên giao diện và hành vi thực tế.";

export const CODE_TASK_PRESETS: CodeTaskPreset[] = [
  {
    id: "js-basic-01",
    label: "Bài 01. Thông tin cá nhân (Dễ · 100 điểm)",
    category: "JavaScript Cơ bản",
    difficulty: "Dễ",
    title: "Bài 01. Thông tin cá nhân",
    description:
      "Tạo chương trình JavaScript khai báo và lưu trữ thông tin cá nhân của một người.\n\n" +
      "Các thông tin cần có:\n" +
      "1. Họ và tên: Nguyễn Văn An.\n" +
      "2. Tuổi: 20.\n" +
      "3. Giới tính: Nam.\n" +
      "4. Sinh viên: Đúng.\n" +
      "5. Ngành học: Công nghệ thông tin.\n" +
      "6. Trường học: HUTECH.\n\n" +
      "Tiêu chí:\n" +
      "- Sử dụng const để khai báo họ tên và trường học.\n" +
      "- Sử dụng let để khai báo tuổi.\n" +
      "- Sử dụng var để khai báo ngành học.\n" +
      "- Có ít nhất một biến kiểu Boolean.\n" +
      "- In toàn bộ thông tin ra Console." +
      COMMON_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 01: Khai báo thông tin cá nhân bằng const, let, var và in ra Console\n`,
      "Bài 01. Thông tin cá nhân",
    ),
    solutionCode: makeJsConsoleFiles(
      `const hoTen = "Nguyễn Văn An";\nlet tuoi = 20;\nconst gioiTinh = "Nam";\nlet laSinhVien = true;\nvar nganhHoc = "Công nghệ thông tin";\nconst truongHoc = "HUTECH";\n\nconsole.log("Họ và tên:", hoTen);\nconsole.log("Tuổi:", tuoi);\nconsole.log("Giới tính:", gioiTinh);\nconsole.log("Sinh viên:", laSinhVien);\nconsole.log("Ngành học:", nganhHoc);\nconsole.log("Trường học:", truongHoc);`,
      "Bài 01. Thông tin cá nhân",
    ),
    criteria: [
      {
        id: "b1_const",
        type: "js_analysis",
        label: "Sử dụng const khai báo họ tên (Nguyễn Văn An) và trường học (HUTECH)",
        selector: "js",
        property: "const_with_value",
        expected: "Nguyễn Văn An&&HUTECH",
        weight: 20,
      },
      {
        id: "b1_let",
        type: "js_analysis",
        label: "Sử dụng let khai báo tuổi (20)",
        selector: "js",
        property: "let_with_value",
        expected: "20",
        weight: 15,
      },
      {
        id: "b1_var",
        type: "js_analysis",
        label: "Sử dụng var khai báo ngành học (Công nghệ thông tin)",
        selector: "js",
        property: "var_with_value",
        expected: "Công nghệ thông tin",
        weight: 15,
      },
      {
        id: "b1_bool",
        type: "js_analysis",
        label: "Có ít nhất một biến kiểu Boolean",
        selector: "js",
        property: "has_boolean",
        expected: ">= 1 Boolean",
        minCount: 1,
        weight: 15,
      },
      {
        id: "b1_console",
        type: "console_contains",
        label: "In toàn bộ 6 thông tin cá nhân ra Console",
        selector: "console",
        property: "regex",
        expected: "Nguyễn Văn An&&\\b20\\b&&Nam&&(?:true|đúng)&&Công nghệ thông tin&&HUTECH",
        weight: 25,
      },
      {
        id: "b1_basic",
        type: "js_analysis",
        label: "Tuân thủ quy định cơ bản (chưa dùng if/vòng lặp/mảng/hàm/DOM)",
        selector: "js",
        property: "no_advanced_syntax",
        expected: "Chỉ dùng kiến thức cơ bản",
        weight: 10,
      },
    ],
  },
  {
    id: "js-basic-02",
    label: "Bài 02. Quản lý sản phẩm (Dễ · 100 điểm)",
    category: "JavaScript Cơ bản",
    difficulty: "Dễ",
    title: "Bài 02. Quản lý sản phẩm",
    description:
      "Tạo chương trình lưu trữ thông tin của một sản phẩm trong cửa hàng.\n\n" +
      "Thông tin sản phẩm:\n" +
      "1. Tên sản phẩm: Laptop Acer Nitro 5.\n" +
      "2. Giá: 18.500.000.\n" +
      "3. Số lượng: 10.\n" +
      "4. Còn hàng: Đúng.\n" +
      "5. Thương hiệu: Acer.\n\n" +
      "Tiêu chí:\n" +
      "- Khai báo tối thiểu 5 biến.\n" +
      "- Sử dụng đầy đủ var, let, const.\n" +
      "- Sử dụng các kiểu dữ liệu String, Number, Boolean.\n" +
      "- In thông tin sản phẩm ra Console." +
      COMMON_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 02: Khai báo thông tin sản phẩm (tối thiểu 5 biến, đủ var/let/const) và in ra Console\n`,
      "Bài 02. Quản lý sản phẩm",
    ),
    solutionCode: makeJsConsoleFiles(
      `const tenSanPham = "Laptop Acer Nitro 5";\nlet giaBan = 18500000;\nlet soLuong = 10;\nvar conHang = true;\nconst thuongHieu = "Acer";\n\nconsole.log("Tên sản phẩm:", tenSanPham);\nconsole.log("Giá:", giaBan);\nconsole.log("Số lượng:", soLuong);\nconsole.log("Còn hàng:", conHang);\nconsole.log("Thương hiệu:", thuongHieu);`,
      "Bài 02. Quản lý sản phẩm",
    ),
    criteria: [
      {
        id: "b2_min5",
        type: "js_analysis",
        label: "Khai báo tối thiểu 5 biến",
        selector: "js",
        property: "min_variables",
        expected: ">= 5 biến",
        minCount: 5,
        weight: 15,
      },
      {
        id: "b2_kw",
        type: "js_analysis",
        label: "Sử dụng đầy đủ cả var, let và const",
        selector: "js",
        property: "all_keywords",
        expected: "var, let, const",
        weight: 20,
      },
      {
        id: "b2_str",
        type: "js_analysis",
        label: "Sử dụng kiểu dữ liệu String",
        selector: "js",
        property: "has_string",
        expected: ">= 1 String",
        minCount: 1,
        weight: 8,
      },
      {
        id: "b2_num",
        type: "js_analysis",
        label: "Sử dụng kiểu dữ liệu Number (Giá, Số lượng)",
        selector: "js",
        property: "has_number",
        expected: ">= 2 Number",
        minCount: 2,
        weight: 10,
      },
      {
        id: "b2_bool",
        type: "js_analysis",
        label: "Sử dụng kiểu dữ liệu Boolean (Còn hàng)",
        selector: "js",
        property: "has_boolean",
        expected: ">= 1 Boolean",
        minCount: 1,
        weight: 7,
      },
      {
        id: "b2_console",
        type: "console_contains",
        label: "In đầy đủ thông tin sản phẩm ra Console",
        selector: "console",
        property: "regex",
        expected: "Laptop Acer Nitro 5&&18[.,_\\s]?500[.,_\\s]?000&&\\b10\\b&&(?:true|đúng)&&Acer",
        weight: 30,
      },
      {
        id: "b2_basic",
        type: "js_analysis",
        label: "Tuân thủ quy định cơ bản (chưa dùng if/vòng lặp/mảng/hàm/DOM)",
        selector: "js",
        property: "no_advanced_syntax",
        expected: "Chỉ dùng kiến thức cơ bản",
        weight: 10,
      },
    ],
  },
  {
    id: "js-basic-03",
    label: "Bài 03. Quản lý khóa học (Trung bình · 100 điểm)",
    category: "JavaScript Cơ bản",
    difficulty: "Trung bình",
    title: "Bài 03. Quản lý khóa học",
    description:
      "Tạo chương trình lưu trữ thông tin một khóa học trực tuyến.\n\n" +
      "Thông tin khóa học:\n" +
      "1. Tên khóa học: JavaScript cơ bản.\n" +
      "2. Mã khóa học: JS001.\n" +
      "3. Học phí: 1.500.000.\n" +
      "4. Thời lượng: 30 giờ.\n" +
      "5. Trạng thái khóa học: Đang mở.\n" +
      "6. Có cấp chứng chỉ: Đúng.\n\n" +
      "Tiêu chí:\n" +
      "- Khai báo ít nhất 6 biến.\n" +
      "- Có đủ 3 kiểu dữ liệu String, Number, Boolean.\n" +
      "- Sử dụng typeof để kiểm tra kiểu dữ liệu của từng biến.\n" +
      "- In kết quả kiểm tra ra Console." +
      COMMON_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 03: Khai báo thông tin khóa học (ít nhất 6 biến), kiểm tra typeof và in ra Console\n`,
      "Bài 03. Quản lý khóa học",
    ),
    solutionCode: makeJsConsoleFiles(
      `const tenKhoaHoc = "JavaScript cơ bản";\nconst maKhoaHoc = "JS001";\nlet hocPhi = 1500000;\nlet thoiLuong = 30;\nvar trangThai = "Đang mở";\nconst coChungChi = true;\n\nconsole.log("Tên khóa học:", tenKhoaHoc, "| Kiểu:", typeof tenKhoaHoc);\nconsole.log("Mã khóa học:", maKhoaHoc, "| Kiểu:", typeof maKhoaHoc);\nconsole.log("Học phí:", hocPhi, "| Kiểu:", typeof hocPhi);\nconsole.log("Thời lượng:", thoiLuong, "giờ | Kiểu:", typeof thoiLuong);\nconsole.log("Trạng thái:", trangThai, "| Kiểu:", typeof trangThai);\nconsole.log("Có cấp chứng chỉ:", coChungChi, "| Kiểu:", typeof coChungChi);`,
      "Bài 03. Quản lý khóa học",
    ),
    criteria: [
      {
        id: "b3_min6",
        type: "js_analysis",
        label: "Khai báo ít nhất 6 biến",
        selector: "js",
        property: "min_variables",
        expected: ">= 6 biến",
        minCount: 6,
        weight: 15,
      },
      {
        id: "b3_str",
        type: "js_analysis",
        label: "Có biến kiểu String",
        selector: "js",
        property: "has_string",
        expected: ">= 1 String",
        minCount: 1,
        weight: 5,
      },
      {
        id: "b3_num",
        type: "js_analysis",
        label: "Có biến kiểu Number (Học phí, Thời lượng)",
        selector: "js",
        property: "has_number",
        expected: ">= 2 Number",
        minCount: 2,
        weight: 10,
      },
      {
        id: "b3_bool",
        type: "js_analysis",
        label: "Có biến kiểu Boolean (Có cấp chứng chỉ)",
        selector: "js",
        property: "has_boolean",
        expected: ">= 1 Boolean",
        minCount: 1,
        weight: 5,
      },
      {
        id: "b3_typeof",
        type: "js_analysis",
        label: "Sử dụng typeof để kiểm tra kiểu dữ liệu từng biến",
        selector: "js",
        property: "uses_typeof",
        expected: ">= 3 lần typeof",
        minCount: 3,
        weight: 20,
      },
      {
        id: "b3_console_info",
        type: "console_contains",
        label: "In đầy đủ 6 thông tin khóa học ra Console",
        selector: "console",
        property: "regex",
        expected: "JavaScript cơ bản&&JS001&&1[.,_\\s]?500[.,_\\s]?000&&\\b30\\b&&Đang mở&&(?:true|đúng)",
        weight: 20,
      },
      {
        id: "b3_console_types",
        type: "console_contains",
        label: "In kết quả kiểm tra typeof (string, number, boolean) ra Console",
        selector: "console",
        expected: "string&&number&&boolean",
        weight: 15,
      },
      {
        id: "b3_basic",
        type: "js_analysis",
        label: "Tuân thủ quy định cơ bản (chưa dùng if/vòng lặp/mảng/hàm/DOM)",
        selector: "js",
        property: "no_advanced_syntax",
        expected: "Chỉ dùng kiến thức cơ bản",
        weight: 10,
      },
    ],
  },
  {
    id: "js-basic-04",
    label: "Bài 04. Thông tin nhân viên (Trung bình · 100 điểm)",
    category: "JavaScript Cơ bản",
    difficulty: "Trung bình",
    title: "Bài 04. Thông tin nhân viên",
    description:
      "Tạo chương trình lưu trữ thông tin của một nhân viên công ty.\n\n" +
      "Thông tin nhân viên:\n" +
      "1. Họ tên: Trần Minh Tuấn.\n" +
      "2. Mã nhân viên: NV001.\n" +
      "3. Tuổi: 25.\n" +
      "4. Lương cơ bản: 12.000.000.\n" +
      "5. Số năm kinh nghiệm: 3.\n" +
      "6. Đang làm việc: Đúng.\n" +
      "7. Phòng ban: Công nghệ thông tin.\n\n" +
      "Tiêu chí:\n" +
      "- Sử dụng ít nhất 7 biến.\n" +
      "- Phân biệt việc sử dụng var, let, const.\n" +
      "- Xác định đúng kiểu dữ liệu cho từng thông tin.\n" +
      "- Sử dụng typeof kiểm tra kiểu dữ liệu.\n" +
      "- In toàn bộ thông tin và kiểu dữ liệu tương ứng ra Console." +
      COMMON_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 04: Khai báo thông tin nhân viên (ít nhất 7 biến, dùng đủ var/let/const), dùng typeof và in ra Console\n`,
      "Bài 04. Thông tin nhân viên",
    ),
    solutionCode: makeJsConsoleFiles(
      `const hoTen = "Trần Minh Tuấn";\nconst maNhanVien = "NV001";\nlet tuoi = 25;\nlet luongCoBan = 12000000;\nlet soNamKinhNghiem = 3;\nlet dangLamViec = true;\nvar phongBan = "Công nghệ thông tin";\n\nconsole.log("Họ tên:", hoTen, "|", typeof hoTen);\nconsole.log("Mã NV:", maNhanVien, "|", typeof maNhanVien);\nconsole.log("Tuổi:", tuoi, "|", typeof tuoi);\nconsole.log("Lương cơ bản:", luongCoBan, "|", typeof luongCoBan);\nconsole.log("Kinh nghiệm:", soNamKinhNghiem, "năm |", typeof soNamKinhNghiem);\nconsole.log("Đang làm việc:", dangLamViec, "|", typeof dangLamViec);\nconsole.log("Phòng ban:", phongBan, "|", typeof phongBan);`,
      "Bài 04. Thông tin nhân viên",
    ),
    criteria: [
      {
        id: "b4_min7",
        type: "js_analysis",
        label: "Sử dụng ít nhất 7 biến",
        selector: "js",
        property: "min_variables",
        expected: ">= 7 biến",
        minCount: 7,
        weight: 15,
      },
      {
        id: "b4_kw",
        type: "js_analysis",
        label: "Phân biệt và sử dụng đầy đủ var, let, const",
        selector: "js",
        property: "all_keywords",
        expected: "var, let, const",
        weight: 15,
      },
      {
        id: "b4_num",
        type: "js_analysis",
        label: "Xác định đúng kiểu Number (Tuổi, Lương, Số năm kinh nghiệm)",
        selector: "js",
        property: "has_number",
        expected: ">= 3 Number",
        minCount: 3,
        weight: 10,
      },
      {
        id: "b4_bool",
        type: "js_analysis",
        label: "Xác định đúng kiểu Boolean (Đang làm việc)",
        selector: "js",
        property: "has_boolean",
        expected: ">= 1 Boolean",
        minCount: 1,
        weight: 5,
      },
      {
        id: "b4_typeof",
        type: "js_analysis",
        label: "Sử dụng typeof kiểm tra kiểu dữ liệu",
        selector: "js",
        property: "uses_typeof",
        expected: ">= 3 lần typeof",
        minCount: 3,
        weight: 15,
      },
      {
        id: "b4_console_info",
        type: "console_contains",
        label: "In toàn bộ 7 thông tin nhân viên ra Console",
        selector: "console",
        property: "regex",
        expected: "Trần Minh Tuấn&&NV001&&\\b25\\b&&12[.,_\\s]?000[.,_\\s]?000&&\\b3\\b&&(?:true|đúng)&&Công nghệ thông tin",
        weight: 20,
      },
      {
        id: "b4_console_types",
        type: "console_contains",
        label: "In kiểu dữ liệu tương ứng (string, number, boolean) ra Console",
        selector: "console",
        expected: "string&&number&&boolean",
        weight: 10,
      },
      {
        id: "b4_basic",
        type: "js_analysis",
        label: "Tuân thủ quy định cơ bản (chưa dùng if/vòng lặp/mảng/hàm/DOM)",
        selector: "js",
        property: "no_advanced_syntax",
        expected: "Chỉ dùng kiến thức cơ bản",
        weight: 10,
      },
    ],
  },
  {
    id: "js-basic-05",
    label: "Bài 05. Quản lý tài khoản ngân hàng (Khá · 100 điểm)",
    category: "JavaScript Cơ bản",
    difficulty: "Khá",
    title: "Bài 05. Quản lý tài khoản ngân hàng",
    description:
      "Tạo chương trình lưu trữ thông tin tài khoản ngân hàng của một khách hàng.\n\n" +
      "Thông tin tài khoản:\n" +
      "1. Tên khách hàng: Nguyễn Thị Mai.\n" +
      "2. Số tài khoản: 123456789012.\n" +
      "3. Số dư: 50.000.000.\n" +
      "4. Loại tài khoản: Thanh toán.\n" +
      "5. Trạng thái tài khoản: Đang hoạt động.\n" +
      "6. Đã xác minh danh tính: Đúng.\n" +
      "7. Ngân hàng: Vietcombank.\n\n" +
      "Tiêu chí:\n" +
      "- Khai báo ít nhất 7 biến.\n" +
      "- Sử dụng đầy đủ var, let, const.\n" +
      "- Xác định kiểu dữ liệu phù hợp cho từng biến.\n" +
      "- Sử dụng typeof để kiểm tra kiểu dữ liệu.\n" +
      "- In thông tin tài khoản ra Console.\n" +
      "- Có ít nhất 2 biến kiểu Boolean và 2 biến kiểu Number." +
      COMMON_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 05: Khai báo thông tin tài khoản ngân hàng (>=7 biến, >=2 Boolean, >=2 Number, đủ var/let/const, typeof)\n`,
      "Bài 05. Quản lý tài khoản ngân hàng",
    ),
    solutionCode: makeJsConsoleFiles(
      `const tenKhachHang = "Nguyễn Thị Mai";\nconst soTaiKhoan = 123456789012;\nlet soDu = 50000000;\nvar loaiTaiKhoan = "Thanh toán";\nlet dangHoatDong = true;\nconst daXacMinh = true;\nconst nganHang = "Vietcombank";\n\nconsole.log("Khách hàng:", tenKhachHang, "|", typeof tenKhachHang);\nconsole.log("Số tài khoản:", soTaiKhoan, "|", typeof soTaiKhoan);\nconsole.log("Số dư:", soDu, "|", typeof soDu);\nconsole.log("Loại tài khoản:", loaiTaiKhoan, "|", typeof loaiTaiKhoan);\nconsole.log("Trạng thái: Đang hoạt động -", dangHoatDong, "|", typeof dangHoatDong);\nconsole.log("Đã xác minh danh tính:", daXacMinh, "|", typeof daXacMinh);\nconsole.log("Ngân hàng:", nganHang, "|", typeof nganHang);`,
      "Bài 05. Quản lý tài khoản ngân hàng",
    ),
    criteria: [
      {
        id: "b5_min7",
        type: "js_analysis",
        label: "Khai báo ít nhất 7 biến",
        selector: "js",
        property: "min_variables",
        expected: ">= 7 biến",
        minCount: 7,
        weight: 10,
      },
      {
        id: "b5_kw",
        type: "js_analysis",
        label: "Sử dụng đầy đủ var, let, const",
        selector: "js",
        property: "all_keywords",
        expected: "var, let, const",
        weight: 15,
      },
      {
        id: "b5_bool2",
        type: "js_analysis",
        label: "Có ít nhất 2 biến kiểu Boolean",
        selector: "js",
        property: "has_boolean",
        expected: ">= 2 Boolean",
        minCount: 2,
        weight: 10,
      },
      {
        id: "b5_num2",
        type: "js_analysis",
        label: "Có ít nhất 2 biến kiểu Number",
        selector: "js",
        property: "has_number",
        expected: ">= 2 Number",
        minCount: 2,
        weight: 10,
      },
      {
        id: "b5_typeof",
        type: "js_analysis",
        label: "Sử dụng typeof để kiểm tra kiểu dữ liệu",
        selector: "js",
        property: "uses_typeof",
        expected: ">= 3 lần typeof",
        minCount: 3,
        weight: 15,
      },
      {
        id: "b5_console_info",
        type: "console_contains",
        label: "In đầy đủ thông tin tài khoản ra Console",
        selector: "console",
        property: "regex",
        expected: "Nguyễn Thị Mai&&123456789012&&50[.,_\\s]?000[.,_\\s]?000&&Thanh toán&&(?:Đang hoạt động|true)&&Vietcombank",
        weight: 20,
      },
      {
        id: "b5_console_types",
        type: "console_contains",
        label: "In kết quả kiểm tra typeof (string, number, boolean) ra Console",
        selector: "console",
        expected: "string&&number&&boolean",
        weight: 10,
      },
      {
        id: "b5_basic",
        type: "js_analysis",
        label: "Tuân thủ quy định cơ bản (chưa dùng if/vòng lặp/mảng/hàm/DOM)",
        selector: "js",
        property: "no_advanced_syntax",
        expected: "Chỉ dùng kiến thức cơ bản",
        weight: 10,
      },
    ],
  },
  {
    id: "js-ops-01",
    label: "Bài 01. Tính toán cơ bản (Dễ · 100 điểm)",
    category: "JavaScript – Toán tử",
    difficulty: "Dễ",
    title: "Bài 01. Tính toán cơ bản",
    description:
      "Viết chương trình khai báo hai số nguyên a = 20 và b = 6.\n\n" +
      "Thực hiện các phép tính:\n" +
      "1. Tính tổng hai số.\n" +
      "2. Tính hiệu hai số.\n" +
      "3. Tính tích hai số.\n" +
      "4. Tính thương hai số.\n" +
      "5. Tính phần dư của phép chia.\n" +
      "6. Tính kết quả a mũ b.\n\n" +
      "Tiêu chí:\n" +
      "- Sử dụng các toán tử +, -, *, /, %, **.\n" +
      "- Lưu kết quả vào các biến riêng biệt.\n" +
      "- In tất cả kết quả ra Console." +
      COMMON_OPERATOR_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 01 (Toán tử): Khai báo a = 20, b = 6 và thực hiện +, -, *, /, %, ** vào các biến riêng\n`,
      "Bài 01. Tính toán cơ bản",
    ),
    solutionCode: makeJsConsoleFiles(
      `const a = 20;\nconst b = 6;\n\nconst tong = a + b;\nconst hieu = a - b;\nconst tich = a * b;\nconst thuong = a / b;\nconst phanDu = a % b;\nconst luyThua = a ** b;\n\nconsole.log("Tổng:", tong);\nconsole.log("Hiệu:", hieu);\nconsole.log("Tích:", tich);\nconsole.log("Thương:", thuong);\nconsole.log("Phần dư:", phanDu);\nconsole.log("a mũ b:", luyThua);`,
      "Bài 01. Tính toán cơ bản",
    ),
    criteria: [
      {
        id: "op_b1_vars",
        type: "js_analysis",
        label: "Khai báo a, b và lưu từng kết quả vào các biến riêng biệt (>= 8 biến)",
        selector: "js",
        property: "min_variables",
        expected: ">= 8 biến",
        minCount: 8,
        weight: 20,
      },
      {
        id: "op_b1_ops",
        type: "js_analysis",
        label: "Sử dụng đầy đủ 6 toán tử số học (+, -, *, /, %, **)",
        selector: "js",
        property: "has_operators",
        expected: "+,-,*,/,%,**",
        weight: 30,
      },
      {
        id: "op_b1_console",
        type: "console_contains",
        label: "In đầy đủ kết quả 6 phép tính (26, 14, 120, 3.33..., 2, 64000000) ra Console",
        selector: "console",
        property: "regex",
        expected: "26&&14&&120&&3[.,]33&&2&&64000000",
        weight: 40,
      },
      {
        id: "op_b1_basic",
        type: "js_analysis",
        label: "Tuân thủ quy định (chưa dùng if/vòng lặp/mảng/hàm/DOM)",
        selector: "js",
        property: "no_advanced_syntax",
        expected: "Chỉ dùng kiến thức cơ bản & toán tử",
        weight: 10,
      },
    ],
  },
  {
    id: "js-ops-02",
    label: "Bài 02. Tính điểm trung bình sinh viên (Dễ · 100 điểm)",
    category: "JavaScript – Toán tử",
    difficulty: "Dễ",
    title: "Bài 02. Tính điểm trung bình sinh viên",
    description:
      "Một sinh viên có điểm các môn học như sau:\n" +
      "- JavaScript: 8.5 điểm.\n" +
      "- Cơ sở dữ liệu: 7.5 điểm.\n" +
      "- Mạng máy tính: 9 điểm.\n\n" +
      "Viết chương trình thực hiện:\n" +
      "1. Tính tổng điểm của 3 môn.\n" +
      "2. Tính điểm trung bình.\n" +
      "3. Kiểm tra điểm JavaScript có lớn hơn điểm Cơ sở dữ liệu không.\n" +
      "4. Kiểm tra điểm trung bình có bằng 8 không.\n" +
      "5. Kiểm tra điểm Mạng máy tính có nhỏ hơn hoặc bằng 9 không.\n\n" +
      "Tiêu chí:\n" +
      "- Sử dụng toán tử số học.\n" +
      "- Sử dụng toán tử so sánh >, <, >=, <=, ==, ===.\n" +
      "- In kết quả tính toán và kiểm tra ra Console." +
      COMMON_OPERATOR_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 02 (Toán tử): Tính tổng, trung bình 3 môn và thực hiện các phép so sánh\n`,
      "Bài 02. Tính điểm trung bình sinh viên",
    ),
    solutionCode: makeJsConsoleFiles(
      `const diemJS = 8.5;\nconst diemCSDL = 7.5;\nconst diemMang = 9;\n\nconst tongDiem = diemJS + diemCSDL + diemMang;\nconst diemTrungBinh = tongDiem / 3;\nconst jsHonCsdl = diemJS > diemCSDL;\nconst tbBang8 = diemTrungBinh == 8;\nconst mangNhoHonBang9 = diemMang <= 9;\n\nconsole.log("Tổng điểm:", tongDiem);\nconsole.log("Điểm trung bình:", diemTrungBinh);\nconsole.log("JS > CSDL:", jsHonCsdl);\nconsole.log("Trung bình == 8:", tbBang8);\nconsole.log("Mạng <= 9:", mangNhoHonBang9);`,
      "Bài 02. Tính điểm trung bình sinh viên",
    ),
    criteria: [
      {
        id: "op_b2_vars",
        type: "js_analysis",
        label: "Khai báo biến lưu điểm và kết quả tính toán (>= 5 biến)",
        selector: "js",
        property: "min_variables",
        expected: ">= 5 biến",
        minCount: 5,
        weight: 15,
      },
      {
        id: "op_b2_arith",
        type: "js_analysis",
        label: "Sử dụng toán tử số học (+, /) để tính tổng và điểm trung bình",
        selector: "js",
        property: "has_operators",
        expected: "+,/",
        weight: 20,
      },
      {
        id: "op_b2_cmp",
        type: "js_analysis",
        label: "Sử dụng các toán tử so sánh (>, ==/===, <=)",
        selector: "js",
        property: "has_operators",
        expected: ">,==|===,<=",
        weight: 25,
      },
      {
        id: "op_b2_console_vals",
        type: "console_contains",
        label: "In tổng điểm (25) và điểm trung bình (8.33...) ra Console",
        selector: "console",
        property: "regex",
        expected: "25&&8[.,]33",
        weight: 15,
      },
      {
        id: "op_b2_console_bools",
        type: "console_contains",
        label: "In kết quả kiểm tra so sánh (true và false) ra Console",
        selector: "console",
        expected: "true&&false",
        weight: 15,
      },
      {
        id: "op_b2_basic",
        type: "js_analysis",
        label: "Tuân thủ quy định (chưa dùng if/vòng lặp/mảng/hàm/DOM)",
        selector: "js",
        property: "no_advanced_syntax",
        expected: "Chỉ dùng kiến thức cơ bản & toán tử",
        weight: 10,
      },
    ],
  },
  {
    id: "js-ops-03",
    label: "Bài 03. Kiểm tra điều kiện mua hàng (Trung bình · 100 điểm)",
    category: "JavaScript – Toán tử",
    difficulty: "Trung bình",
    title: "Bài 03. Kiểm tra điều kiện mua hàng",
    description:
      "Một cửa hàng có chương trình ưu đãi với thông tin khách hàng:\n" +
      "- Tổng giá trị đơn hàng: 1.500.000 VNĐ.\n" +
      "- Khách hàng là thành viên: true.\n" +
      "- Khách hàng có mã giảm giá: false.\n" +
      "- Giá trị đơn hàng tối thiểu để được giảm giá: 1.000.000 VNĐ.\n\n" +
      "Viết chương trình kiểm tra:\n" +
      "1. Đơn hàng có đạt giá trị tối thiểu không?\n" +
      "2. Khách hàng có phải thành viên không?\n" +
      "3. Khách hàng có mã giảm giá không?\n" +
      "4. Khách hàng có được ưu đãi khi là thành viên và đơn hàng đạt giá trị tối thiểu không?\n" +
      "5. Khách hàng có được ưu đãi nếu là thành viên hoặc có mã giảm giá không?\n" +
      "6. Khách hàng không phải thành viên có kết quả như thế nào khi sử dụng toán tử !?\n\n" +
      "Tiêu chí:\n" +
      "- Sử dụng toán tử so sánh.\n" +
      "- Sử dụng toán tử logic &&, ||, !.\n" +
      "- In kết quả dưới dạng true hoặc false." +
      COMMON_OPERATOR_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 03 (Toán tử): Kiểm tra điều kiện mua hàng bằng toán tử so sánh và logic &&, ||, !\n`,
      "Bài 03. Kiểm tra điều kiện mua hàng",
    ),
    solutionCode: makeJsConsoleFiles(
      `const tongDonHang = 1500000;\nconst laThanhVien = true;\nconst coMaGiamGia = false;\nconst donHangToiThieu = 1000000;\n\nconst datGiaTriToiThieu = tongDonHang >= donHangToiThieu;\nconst uuDaiThanhVien = laThanhVien && datGiaTriToiThieu;\nconst uuDaiThanhVienHoacMa = laThanhVien || coMaGiamGia;\nconst khongPhaiThanhVien = !laThanhVien;\n\nconsole.log("1. Đạt giá trị tối thiểu:", datGiaTriToiThieu);\nconsole.log("2. Là thành viên:", laThanhVien);\nconsole.log("3. Có mã giảm giá:", coMaGiamGia);\nconsole.log("4. Ưu đãi (thành viên && đạt tối thiểu):", uuDaiThanhVien);\nconsole.log("5. Ưu đãi (thành viên || mã giảm giá):", uuDaiThanhVienHoacMa);\nconsole.log("6. Không phải thành viên (!):", khongPhaiThanhVien);`,
      "Bài 03. Kiểm tra điều kiện mua hàng",
    ),
    criteria: [
      {
        id: "op_b3_vars",
        type: "js_analysis",
        label: "Khai báo đầy đủ biến thông tin đơn hàng và kết quả (>= 4 biến)",
        selector: "js",
        property: "min_variables",
        expected: ">= 4 biến",
        minCount: 4,
        weight: 15,
      },
      {
        id: "op_b3_cmp",
        type: "js_analysis",
        label: "Sử dụng toán tử so sánh để kiểm tra giá trị đơn hàng tối thiểu",
        selector: "js",
        property: "has_operators",
        expected: ">=|>|<=|<",
        weight: 15,
      },
      {
        id: "op_b3_logic",
        type: "js_analysis",
        label: "Sử dụng đầy đủ 3 toán tử logic &&, ||, !",
        selector: "js",
        property: "has_operators",
        expected: "&&,||,!",
        weight: 35,
      },
      {
        id: "op_b3_console",
        type: "console_contains",
        label: "In kết quả kiểm tra dưới dạng true và false ra Console",
        selector: "console",
        expected: "true&&false",
        weight: 25,
      },
      {
        id: "op_b3_basic",
        type: "js_analysis",
        label: "Tuân thủ quy định (chưa dùng if/vòng lặp/mảng/hàm/DOM)",
        selector: "js",
        property: "no_advanced_syntax",
        expected: "Chỉ dùng kiến thức cơ bản & toán tử",
        weight: 10,
      },
    ],
  },
  {
    id: "js-ops-04",
    label: "Bài 04. Tính lương nhân viên (Trung bình · 100 điểm)",
    category: "JavaScript – Toán tử",
    difficulty: "Trung bình",
    title: "Bài 04. Tính lương nhân viên",
    description:
      "Một nhân viên có thông tin:\n" +
      "- Lương cơ bản: 8.000.000 VNĐ.\n" +
      "- Số ngày công: 26 ngày.\n" +
      "- Số ngày làm thực tế: 24 ngày.\n" +
      "- Tiền thưởng: 1.000.000 VNĐ.\n" +
      "- Tiền phạt: 200.000 VNĐ.\n\n" +
      "Viết chương trình thực hiện:\n" +
      "1. Tính tiền lương một ngày.\n" +
      "2. Tính tiền lương theo số ngày làm thực tế.\n" +
      "3. Tính tổng thu nhập sau khi cộng thưởng và trừ phạt.\n" +
      "4. Kiểm tra nhân viên có làm đủ 26 ngày không.\n" +
      "5. Kiểm tra thu nhập có lớn hơn 8.000.000 VNĐ không.\n" +
      "6. Kiểm tra nhân viên có làm trên 20 ngày và thu nhập lớn hơn 8.000.000 VNĐ không.\n\n" +
      "Tiêu chí:\n" +
      "- Sử dụng toán tử số học.\n" +
      "- Sử dụng toán tử so sánh.\n" +
      "- Sử dụng toán tử logic &&.\n" +
      "- Lưu từng kết quả vào biến riêng biệt." +
      COMMON_OPERATOR_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 04 (Toán tử): Tính lương ngày, lương thực tế, tổng thu nhập và các kiểm tra\n`,
      "Bài 04. Tính lương nhân viên",
    ),
    solutionCode: makeJsConsoleFiles(
      `const luongCoBan = 8000000;\nconst soNgayCong = 26;\nconst soNgayLamThucTe = 24;\nconst tienThuong = 1000000;\nconst tienPhat = 200000;\n\nconst luongMotNgay = luongCoBan / soNgayCong;\nconst luongThucTe = luongMotNgay * soNgayLamThucTe;\nconst tongThuNhap = luongThucTe + tienThuong - tienPhat;\nconst lamDu26Ngay = soNgayLamThucTe === soNgayCong;\nconst thuNhapHon8Tr = tongThuNhap > 8000000;\nconst datDieuKien = soNgayLamThucTe > 20 && tongThuNhap > 8000000;\n\nconsole.log("1. Lương một ngày:", luongMotNgay);\nconsole.log("2. Lương thực tế:", luongThucTe);\nconsole.log("3. Tổng thu nhập:", tongThuNhap);\nconsole.log("4. Làm đủ 26 ngày:", lamDu26Ngay);\nconsole.log("5. Thu nhập > 8.000.000:", thuNhapHon8Tr);\nconsole.log("6. Làm > 20 ngày && thu nhập > 8tr:", datDieuKien);`,
      "Bài 04. Tính lương nhân viên",
    ),
    criteria: [
      {
        id: "op_b4_vars",
        type: "js_analysis",
        label: "Lưu thông tin đầu vào và từng kết quả vào biến riêng biệt (>= 8 biến)",
        selector: "js",
        property: "min_variables",
        expected: ">= 8 biến",
        minCount: 8,
        weight: 15,
      },
      {
        id: "op_b4_arith",
        type: "js_analysis",
        label: "Sử dụng đầy đủ toán tử số học (/, *, +, -) tính lương và thu nhập",
        selector: "js",
        property: "has_operators",
        expected: "/,*,+,-",
        weight: 20,
      },
      {
        id: "op_b4_cmp_logic",
        type: "js_analysis",
        label: "Sử dụng toán tử so sánh (==/===, >) và toán tử logic &&",
        selector: "js",
        property: "has_operators",
        expected: "==|===,>,&&",
        weight: 25,
      },
      {
        id: "op_b4_console_nums",
        type: "console_contains",
        label: "In lương 1 ngày (~307692), lương thực tế (~7384615) và tổng thu nhập (~8184615) ra Console",
        selector: "console",
        property: "regex",
        expected: "307[.,]?692&&7[.,]?384[.,]?6(?:15|08)&&8[.,]?184[.,]?6(?:15|08)",
        weight: 20,
      },
      {
        id: "op_b4_console_bools",
        type: "console_contains",
        label: "In kết quả kiểm tra ngày công và thu nhập (true và false) ra Console",
        selector: "console",
        expected: "true&&false",
        weight: 10,
      },
      {
        id: "op_b4_basic",
        type: "js_analysis",
        label: "Tuân thủ quy định (chưa dùng if/vòng lặp/mảng/hàm/DOM)",
        selector: "js",
        property: "no_advanced_syntax",
        expected: "Chỉ dùng kiến thức cơ bản & toán tử",
        weight: 10,
      },
    ],
  },
  {
    id: "js-ops-05",
    label: "Bài 05. Kiểm tra điều kiện đăng ký khóa học (Khá · 100 điểm)",
    category: "JavaScript – Toán tử",
    difficulty: "Khá",
    title: "Bài 05. Kiểm tra điều kiện đăng ký khóa học",
    description:
      "Một trung tâm đào tạo lập trình có các điều kiện đăng ký khóa học như sau:\n\n" +
      "Thông tin học viên:\n" +
      "- Tuổi: 20.\n" +
      "- Điểm kiểm tra đầu vào: 8.\n" +
      "- Đã có kiến thức cơ bản: true.\n" +
      "- Đã thanh toán học phí: false.\n" +
      "- Tuổi tối thiểu: 18.\n" +
      "- Điểm đầu vào tối thiểu: 7.\n\n" +
      "Viết chương trình kiểm tra:\n" +
      "1. Học viên có đủ tuổi đăng ký không?\n" +
      "2. Học viên có đạt điểm đầu vào không?\n" +
      "3. Học viên có kiến thức cơ bản không?\n" +
      "4. Học viên có đủ điều kiện đăng ký khi đáp ứng cả ba điều kiện đầu tiên không?\n" +
      "5. Học viên đã thanh toán học phí chưa?\n" +
      "6. Học viên có đủ điều kiện nhập học khi vừa đạt yêu cầu đầu vào vừa thanh toán học phí không?\n" +
      "7. Kiểm tra kết quả khi sử dụng toán tử phủ định ! với trạng thái thanh toán.\n\n" +
      "Tiêu chí:\n" +
      "- Sử dụng các toán tử số học, so sánh (>, <, >=, <=, ==, ===, !==) và logic (&&, ||, !) phù hợp.\n" +
      "- In toàn bộ kết quả ra Console." +
      COMMON_OPERATOR_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 05 (Toán tử): Kiểm tra 7 điều kiện đăng ký và nhập học của học viên\n`,
      "Bài 05. Kiểm tra điều kiện đăng ký khóa học",
    ),
    solutionCode: makeJsConsoleFiles(
      `const tuoi = 20;\nconst diemDauVao = 8;\nconst coKienThucCoBan = true;\nconst daThanhToan = false;\nconst tuoiToiThieu = 18;\nconst diemToiThieu = 7;\n\nconst duTuoi = tuoi >= tuoiToiThieu;\nconst datDiem = diemDauVao >= diemToiThieu;\nconst duDieuKienDangKy = duTuoi && datDiem && coKienThucCoBan;\nconst duDieuKienNhapHoc = duDieuKienDangKy && daThanhToan;\nconst chuaThanhToan = !daThanhToan;\n\nconsole.log("1. Đủ tuổi:", duTuoi);\nconsole.log("2. Đạt điểm đầu vào:", datDiem);\nconsole.log("3. Có kiến thức cơ bản:", coKienThucCoBan);\nconsole.log("4. Đủ điều kiện đăng ký:", duDieuKienDangKy);\nconsole.log("5. Đã thanh toán học phí:", daThanhToan);\nconsole.log("6. Đủ điều kiện nhập học:", duDieuKienNhapHoc);\nconsole.log("7. Phủ định thanh toán (!):", chuaThanhToan);`,
      "Bài 05. Kiểm tra điều kiện đăng ký khóa học",
    ),
    criteria: [
      {
        id: "op_b5_vars",
        type: "js_analysis",
        label: "Khai báo đầy đủ thông tin học viên và điều kiện đầu vào (>= 6 biến)",
        selector: "js",
        property: "min_variables",
        expected: ">= 6 biến",
        minCount: 6,
        weight: 15,
      },
      {
        id: "op_b5_cmp",
        type: "js_analysis",
        label: "Sử dụng toán tử so sánh (>= hoặc >) để kiểm tra tuổi và điểm",
        selector: "js",
        property: "has_operators",
        expected: ">=|>",
        weight: 15,
      },
      {
        id: "op_b5_logic",
        type: "js_analysis",
        label: "Sử dụng toán tử logic && và phủ định !",
        selector: "js",
        property: "has_operators",
        expected: "&&,!",
        weight: 30,
      },
      {
        id: "op_b5_console",
        type: "console_contains",
        label: "In toàn bộ kết quả kiểm tra (gồm true và false) ra Console",
        selector: "console",
        expected: "true&&false",
        weight: 30,
      },
      {
        id: "op_b5_basic",
        type: "js_analysis",
        label: "Tuân thủ quy định (chưa dùng if/vòng lặp/mảng/hàm/DOM)",
        selector: "js",
        property: "no_advanced_syntax",
        expected: "Chỉ dùng kiến thức cơ bản & toán tử",
        weight: 10,
      },
    ],
  },
  {
    id: "js-cond-01",
    label: "Bài 01. Xếp loại học lực sinh viên (Dễ · 100 điểm)",
    category: "JavaScript – Câu lệnh điều kiện",
    difficulty: "Dễ",
    title: "Bài 01. Xếp loại học lực sinh viên",
    description:
      "Viết chương trình khai báo điểm trung bình của một sinh viên:\n" +
      "- Điểm trung bình: 8.2.\n\n" +
      "Sử dụng câu lệnh điều kiện để xếp loại học lực theo quy tắc:\n" +
      "- Từ 9.0 trở lên: Xuất sắc\n" +
      "- Từ 8.0 đến dưới 9.0: Giỏi\n" +
      "- Từ 6.5 đến dưới 8.0: Khá\n" +
      "- Từ 5.0 đến dưới 6.5: Trung bình\n" +
      "- Dưới 5.0: Yếu\n\n" +
      "Tiêu chí:\n" +
      "- Sử dụng if, else if, else.\n" +
      "- Kiểm tra điểm có nằm trong khoảng từ 0 đến 10 không.\n" +
      "- In kết quả xếp loại ra Console." +
      COMMON_CONDITIONAL_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 01 (Câu lệnh điều kiện): Khai báo điểm trung bình = 8.2, kiểm tra [0, 10] và xếp loại học lực\n`,
      "Bài 01. Xếp loại học lực sinh viên",
    ),
    solutionCode: makeJsConsoleFiles(
      `const diemTrungBinh = 8.2;\n\nif (diemTrungBinh < 0 || diemTrungBinh > 10) {\n  console.log("Điểm không hợp lệ! Điểm phải nằm trong khoảng từ 0 đến 10.");\n} else if (diemTrungBinh >= 9.0) {\n  console.log("Xếp loại học lực: Xuất sắc");\n} else if (diemTrungBinh >= 8.0) {\n  console.log("Xếp loại học lực: Giỏi");\n} else if (diemTrungBinh >= 6.5) {\n  console.log("Xếp loại học lực: Khá");\n} else if (diemTrungBinh >= 5.0) {\n  console.log("Xếp loại học lực: Trung bình");\n} else {\n  console.log("Xếp loại học lực: Yếu");\n}`,
      "Bài 01. Xếp loại học lực sinh viên",
    ),
    criteria: [
      {
        id: "cond_b1_ifelse",
        type: "js_analysis",
        label: "Sử dụng đầy đủ cấu trúc if, else if, else",
        selector: "js",
        property: "uses_if_else",
        expected: "else_if",
        weight: 25,
      },
      {
        id: "cond_b1_cmp",
        type: "js_analysis",
        label: "Sử dụng toán tử so sánh để xét mốc điểm",
        selector: "js",
        property: "has_operators",
        expected: ">=|<=|>|<",
        weight: 15,
      },
      {
        id: "cond_b1_logic",
        type: "js_analysis",
        label: "Kiểm tra khoảng điểm hợp lệ từ 0 đến 10 bằng toán tử logic (|| hoặc &&)",
        selector: "js",
        property: "has_operators",
        expected: "&&,||",
        minCount: 1,
        weight: 15,
      },
      {
        id: "cond_b1_console",
        type: "console_contains",
        label: "In đúng kết quả xếp loại với điểm 8.2 (Giỏi) ra Console",
        selector: "console",
        property: "regex",
        expected: "giỏi",
        weight: 35,
      },
      {
        id: "cond_b1_scope",
        type: "js_analysis",
        label: "Tuân thủ phạm vi bài 01–04 (chưa dùng vòng lặp/mảng/hàm/DOM)",
        selector: "js",
        property: "no_loops_funcs_dom",
        expected: "Chỉ dùng kiến thức bài 01–04",
        weight: 10,
      },
    ],
  },
  {
    id: "js-cond-02",
    label: "Bài 02. Kiểm tra số chẵn và số lẻ (Dễ · 100 điểm)",
    category: "JavaScript – Câu lệnh điều kiện",
    difficulty: "Dễ",
    title: "Bài 02. Kiểm tra số chẵn và số lẻ",
    description:
      "Viết chương trình khai báo một số nguyên bất kỳ:\n" +
      "- Số cần kiểm tra: 17.\n\n" +
      "Sử dụng câu lệnh điều kiện để:\n" +
      "1. Kiểm tra số đó là số chẵn hay số lẻ.\n" +
      "2. Kiểm tra số đó là số dương, số âm hay bằng 0.\n" +
      "3. Kiểm tra số đó có chia hết cho cả 3 và 5 không.\n\n" +
      "Tiêu chí:\n" +
      "- Sử dụng if, else.\n" +
      "- Sử dụng toán tử %.\n" +
      "- Sử dụng toán tử logic &&.\n" +
      "- In kết quả kiểm tra ra Console." +
      COMMON_CONDITIONAL_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 02 (Câu lệnh điều kiện): Kiểm tra số 17 (chẵn/lẻ, dương/âm/0, chia hết cho cả 3 và 5)\n`,
      "Bài 02. Kiểm tra số chẵn và số lẻ",
    ),
    solutionCode: makeJsConsoleFiles(
      `const soNguyen = 17;\n\nif (soNguyen % 2 === 0) {\n  console.log(soNguyen, "là số chẵn");\n} else {\n  console.log(soNguyen, "là số lẻ");\n}\n\nif (soNguyen > 0) {\n  console.log(soNguyen, "là số dương");\n} else if (soNguyen < 0) {\n  console.log(soNguyen, "là số âm");\n} else {\n  console.log("Số bằng 0");\n}\n\nif (soNguyen % 3 === 0 && soNguyen % 5 === 0) {\n  console.log(soNguyen, "chia hết cho cả 3 và 5");\n} else {\n  console.log(soNguyen, "không chia hết cho cả 3 và 5");\n}`,
      "Bài 02. Kiểm tra số chẵn và số lẻ",
    ),
    criteria: [
      {
        id: "cond_b2_ifelse",
        type: "js_analysis",
        label: "Sử dụng câu lệnh điều kiện if, else",
        selector: "js",
        property: "uses_if_else",
        expected: "if_else",
        weight: 20,
      },
      {
        id: "cond_b2_mod",
        type: "js_analysis",
        label: "Sử dụng toán tử chia lấy dư %",
        selector: "js",
        property: "has_operators",
        expected: "%",
        weight: 20,
      },
      {
        id: "cond_b2_logic",
        type: "js_analysis",
        label: "Sử dụng toán tử logic && kiểm tra chia hết cho cả 3 và 5",
        selector: "js",
        property: "has_operators",
        expected: "&&",
        weight: 20,
      },
      {
        id: "cond_b2_console",
        type: "console_contains",
        label: "In đầy đủ kết quả kiểm tra số 17 (số lẻ, số dương, không chia hết cho 3 và 5) ra Console",
        selector: "console",
        property: "regex",
        expected: "lẻ&&dương&&(?:không|chưa|false|sai)",
        weight: 30,
      },
      {
        id: "cond_b2_scope",
        type: "js_analysis",
        label: "Tuân thủ phạm vi bài 01–04 (chưa dùng vòng lặp/mảng/hàm/DOM)",
        selector: "js",
        property: "no_loops_funcs_dom",
        expected: "Chỉ dùng kiến thức bài 01–04",
        weight: 10,
      },
    ],
  },
  {
    id: "js-cond-03",
    label: "Bài 03. Máy tính bỏ túi (Trung bình · 100 điểm)",
    category: "JavaScript – Câu lệnh điều kiện",
    difficulty: "Trung bình",
    title: "Bài 03. Máy tính bỏ túi",
    description:
      "Viết chương trình máy tính đơn giản với hai số:\n" +
      "- Số thứ nhất: 20.\n" +
      "- Số thứ hai: 5.\n" +
      "- Phép tính: *.\n\n" +
      "Chương trình thực hiện các phép tính: +, -, *, /.\n\n" +
      "Tiêu chí:\n" +
      "- Sử dụng switch để lựa chọn phép tính.\n" +
      "- Tính toán theo phép tính được chọn.\n" +
      "- Kiểm tra trường hợp chia cho 0.\n" +
      "- Thông báo nếu người dùng chọn phép tính không hợp lệ.\n" +
      "- In kết quả ra Console." +
      COMMON_CONDITIONAL_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 03 (Câu lệnh điều kiện): Máy tính bỏ túi với switch (+, -, *, /), kiểm tra chia cho 0\n`,
      "Bài 03. Máy tính bỏ túi",
    ),
    solutionCode: makeJsConsoleFiles(
      `const soThuNhat = 20;\nconst soThuHai = 5;\nconst phepTinh = "*";\n\nswitch (phepTinh) {\n  case "+":\n    console.log("Kết quả cộng:", soThuNhat + soThuHai);\n    break;\n  case "-":\n    console.log("Kết quả trừ:", soThuNhat - soThuHai);\n    break;\n  case "*":\n    console.log("Kết quả nhân:", soThuNhat * soThuHai);\n    break;\n  case "/":\n    if (soThuHai === 0) {\n      console.log("Lỗi: Không thể chia cho 0");\n    } else {\n      console.log("Kết quả chia:", soThuNhat / soThuHai);\n    }\n    break;\n  default:\n    console.log("Phép tính không hợp lệ!");\n}`,
      "Bài 03. Máy tính bỏ túi",
    ),
    criteria: [
      {
        id: "cond_b3_switch",
        type: "js_analysis",
        label: "Sử dụng switch với ít nhất 4 case (+, -, *, /) và nhánh default báo không hợp lệ",
        selector: "js",
        property: "uses_switch",
        expected: "with_default",
        minCount: 4,
        weight: 30,
      },
      {
        id: "cond_b3_ops",
        type: "js_analysis",
        label: "Cài đặt đủ 4 phép tính cộng (+), trừ (-), nhân (*), chia (/)",
        selector: "js",
        property: "has_operators",
        expected: "+,-,*,/",
        weight: 20,
      },
      {
        id: "cond_b3_zero",
        type: "js_analysis",
        label: "Sử dụng if kiểm tra trường hợp chia cho 0",
        selector: "js",
        property: "uses_if_else",
        expected: "if",
        weight: 15,
      },
      {
        id: "cond_b3_console",
        type: "console_contains",
        label: "In đúng kết quả 20 * 5 = 100 ra Console",
        selector: "console",
        expected: "100",
        weight: 25,
      },
      {
        id: "cond_b3_scope",
        type: "js_analysis",
        label: "Tuân thủ phạm vi bài 01–04 (chưa dùng vòng lặp/mảng/hàm/DOM)",
        selector: "js",
        property: "no_loops_funcs_dom",
        expected: "Chỉ dùng kiến thức bài 01–04",
        weight: 10,
      },
    ],
  },
  {
    id: "js-cond-04",
    label: "Bài 04. Tính tiền điện sinh hoạt (Trung bình · 100 điểm)",
    category: "JavaScript – Câu lệnh điều kiện",
    difficulty: "Trung bình",
    title: "Bài 04. Tính tiền điện sinh hoạt",
    description:
      "Viết chương trình tính tiền điện dựa trên số điện tiêu thụ của một hộ gia đình:\n" +
      "- Số điện tiêu thụ: 250 kWh.\n\n" +
      "Áp dụng bảng giá giả định theo phương pháp lũy tiến:\n" +
      "- Bậc 1 (0–50 kWh): 1.800đ/kWh\n" +
      "- Bậc 2 (51–100 kWh): 2.000đ/kWh\n" +
      "- Bậc 3 (101–200 kWh): 2.500đ/kWh\n" +
      "- Bậc 4 (Trên 200 kWh): 3.000đ/kWh\n\n" +
      "Tiêu chí:\n" +
      "- Sử dụng if, else if, else để xác định bậc điện.\n" +
      "- Tính tiền điện theo phương pháp lũy tiến, mỗi bậc có đơn giá riêng.\n" +
      "- Kiểm tra số điện nhập vào không được nhỏ hơn 0.\n" +
      "- In số điện tiêu thụ và tổng tiền điện ra Console." +
      COMMON_CONDITIONAL_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 04 (Câu lệnh điều kiện): Tính tiền điện lũy tiến cho 250 kWh bằng if / else if / else\n`,
      "Bài 04. Tính tiền điện sinh hoạt",
    ),
    solutionCode: makeJsConsoleFiles(
      `const soDien = 250;\nlet tongTien = 0;\n\nif (soDien < 0) {\n  console.log("Số điện không hợp lệ (không được nhỏ hơn 0)");\n} else if (soDien <= 50) {\n  tongTien = soDien * 1800;\n  console.log("Số điện tiêu thụ:", soDien, "kWh | Tổng tiền điện:", tongTien, "đ");\n} else if (soDien <= 100) {\n  tongTien = 50 * 1800 + (soDien - 50) * 2000;\n  console.log("Số điện tiêu thụ:", soDien, "kWh | Tổng tiền điện:", tongTien, "đ");\n} else if (soDien <= 200) {\n  tongTien = 50 * 1800 + 50 * 2000 + (soDien - 100) * 2500;\n  console.log("Số điện tiêu thụ:", soDien, "kWh | Tổng tiền điện:", tongTien, "đ");\n} else {\n  tongTien = 50 * 1800 + 50 * 2000 + 100 * 2500 + (soDien - 200) * 3000;\n  console.log("Số điện tiêu thụ:", soDien, "kWh | Tổng tiền điện:", tongTien, "đ");\n}`,
      "Bài 04. Tính tiền điện sinh hoạt",
    ),
    criteria: [
      {
        id: "cond_b4_ifelse",
        type: "js_analysis",
        label: "Sử dụng đầy đủ if, else if, else để kiểm tra và chia 4 bậc điện",
        selector: "js",
        property: "uses_if_else",
        expected: "else_if",
        weight: 25,
      },
      {
        id: "cond_b4_ops",
        type: "js_analysis",
        label: "Sử dụng toán tử +, * để tính tiền điện lũy tiến từng bậc",
        selector: "js",
        property: "has_operators",
        expected: "+,*",
        weight: 15,
      },
      {
        id: "cond_b4_cmp",
        type: "js_analysis",
        label: "Kiểm tra số điện không âm (< 0) và các ngưỡng bậc (<= hoặc >)",
        selector: "js",
        property: "has_operators",
        expected: "<,<=,>=|>",
        minCount: 2,
        weight: 15,
      },
      {
        id: "cond_b4_console",
        type: "console_contains",
        label: "In số điện tiêu thụ (250) và tổng tiền lũy tiến (590.000đ) ra Console",
        selector: "console",
        property: "regex",
        expected: "250&&590[.,]?000",
        weight: 35,
      },
      {
        id: "cond_b4_scope",
        type: "js_analysis",
        label: "Tuân thủ phạm vi bài 01–04 (chưa dùng vòng lặp/mảng/hàm/DOM)",
        selector: "js",
        property: "no_loops_funcs_dom",
        expected: "Chỉ dùng kiến thức bài 01–04",
        weight: 10,
      },
    ],
  },
  {
    id: "js-cond-05",
    label: "Bài 05. Hệ thống quản lý đơn hàng (Khá · 100 điểm)",
    category: "JavaScript – Câu lệnh điều kiện",
    difficulty: "Khá",
    title: "Bài 05. Hệ thống quản lý đơn hàng",
    description:
      "Một cửa hàng trực tuyến có hệ thống quản lý trạng thái đơn hàng.\n\n" +
      "Thông tin đơn hàng:\n" +
      "- Mã đơn hàng: DH001.\n" +
      "- Giá trị đơn hàng: 2.500.000 VNĐ.\n" +
      "- Trạng thái: 2.\n\n" +
      "Quy định trạng thái: 1 - Chờ xác nhận | 2 - Đã xác nhận | 3 - Đang giao hàng | 4 - Đã giao hàng | 5 - Đã hủy.\n" +
      "Chính sách vận chuyển: Từ 2.000.000 VNĐ trở lên miễn phí; dưới 2.000.000 VNĐ phí 30.000 VNĐ; đơn đã hủy không tính phí vận chuyển.\n\n" +
      "Tiêu chí:\n" +
      "1. Sử dụng switch để hiển thị trạng thái đơn hàng.\n" +
      "2. Sử dụng if/else để kiểm tra điều kiện miễn phí vận chuyển.\n" +
      "3. Sử dụng toán tử logic để kiểm tra đơn hàng có hợp lệ không.\n" +
      "4. Xử lý trường hợp mã trạng thái không tồn tại.\n" +
      "5. Tính tổng tiền khách hàng cần thanh toán.\n" +
      "6. In đầy đủ thông tin đơn hàng ra Console." +
      COMMON_CONDITIONAL_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 05 (Câu lệnh điều kiện): Quản lý đơn hàng DH001 (2.500.000 VNĐ, trạng thái 2) bằng switch + if/else + logic\n`,
      "Bài 05. Hệ thống quản lý đơn hàng",
    ),
    solutionCode: makeJsConsoleFiles(
      `const maDonHang = "DH001";\nconst giaTriDonHang = 2500000;\nconst trangThai = 2;\n\nlet tenTrangThai = "";\nlet phiVanChuyen = 0;\nlet ghiChuVanChuyen = "";\nlet tongThanhToan = 0;\n\nswitch (trangThai) {\n  case 1:\n    tenTrangThai = "Chờ xác nhận";\n    break;\n  case 2:\n    tenTrangThai = "Đã xác nhận";\n    break;\n  case 3:\n    tenTrangThai = "Đang giao hàng";\n    break;\n  case 4:\n    tenTrangThai = "Đã giao hàng";\n    break;\n  case 5:\n    tenTrangThai = "Đã hủy";\n    break;\n  default:\n    tenTrangThai = "Mã trạng thái không tồn tại";\n}\n\nconst donHangHopLe = giaTriDonHang > 0 && trangThai >= 1 && trangThai <= 5;\n\nif (!donHangHopLe) {\n  console.log("Đơn hàng không hợp lệ hoặc mã trạng thái không tồn tại!");\n} else if (trangThai === 5) {\n  phiVanChuyen = 0;\n  tongThanhToan = 0;\n  console.log("Mã đơn:", maDonHang, "| Trạng thái:", tenTrangThai, "| Đơn hàng đã hủy, không tính phí vận chuyển.");\n} else {\n  if (giaTriDonHang >= 2000000) {\n    phiVanChuyen = 0;\n    ghiChuVanChuyen = "Miễn phí vận chuyển (0 VNĐ)";\n  } else {\n    phiVanChuyen = 30000;\n    ghiChuVanChuyen = "30.000 VNĐ";\n  }\n  tongThanhToan = giaTriDonHang + phiVanChuyen;\n  console.log("Mã đơn hàng:", maDonHang);\n  console.log("Trạng thái:", tenTrangThai);\n  console.log("Giá trị đơn hàng:", giaTriDonHang, "VNĐ");\n  console.log("Vận chuyển:", ghiChuVanChuyen);\n  console.log("Tổng thanh toán:", tongThanhToan, "VNĐ");\n}`,
      "Bài 05. Hệ thống quản lý đơn hàng",
    ),
    criteria: [
      {
        id: "cond_b5_switch",
        type: "js_analysis",
        label: "Sử dụng switch cho 5 trạng thái (1–5) và default xử lý mã không tồn tại",
        selector: "js",
        property: "uses_switch",
        expected: "with_default",
        minCount: 5,
        weight: 25,
      },
      {
        id: "cond_b5_ifelse",
        type: "js_analysis",
        label: "Sử dụng if/else kiểm tra điều kiện miễn phí vận chuyển và đơn hợp lệ",
        selector: "js",
        property: "uses_if_else",
        expected: "if_else",
        weight: 15,
      },
      {
        id: "cond_b5_logic",
        type: "js_analysis",
        label: "Sử dụng toán tử logic (&&, || hoặc !) kiểm tra đơn hàng hợp lệ",
        selector: "js",
        property: "has_operators",
        expected: "&&,||,!",
        minCount: 1,
        weight: 15,
      },
      {
        id: "cond_b5_console_info",
        type: "console_contains",
        label: "In mã đơn (DH001), trạng thái (Đã xác nhận) và tổng tiền (2.500.000) ra Console",
        selector: "console",
        property: "regex",
        expected: "DH001&&Đã xác nhận&&2[.,]?500[.,]?000",
        weight: 25,
      },
      {
        id: "cond_b5_console_ship",
        type: "console_contains",
        label: "Thể hiện trạng thái miễn phí vận chuyển (0 VNĐ) ra Console",
        selector: "console",
        property: "regex",
        expected: "(?:miễn phí|0\\s*(?:vnđ|đ|vnd)|phí vận chuyển[:\\s]*0)",
        weight: 10,
      },
      {
        id: "cond_b5_scope",
        type: "js_analysis",
        label: "Tuân thủ phạm vi bài 01–04 (chưa dùng vòng lặp/mảng/hàm/DOM)",
        selector: "js",
        property: "no_loops_funcs_dom",
        expected: "Chỉ dùng kiến thức bài 01–04",
        weight: 10,
      },
    ],
  },
  {
    id: "js-loop-01",
    label: "Bài 01. In dãy số tự nhiên (Dễ · 100 điểm)",
    category: "JavaScript – Vòng lặp",
    difficulty: "Dễ",
    title: "Bài 01. In dãy số tự nhiên",
    description:
      "Viết chương trình sử dụng vòng lặp để in các số tự nhiên từ 1 đến 10.\n\n" +
      "Tiêu chí:\n" +
      "1. Sử dụng vòng lặp for để in các số từ 1 đến 10.\n" +
      "2. Sử dụng vòng lặp while để thực hiện lại yêu cầu trên.\n" +
      "3. Sử dụng vòng lặp do...while để thực hiện lại yêu cầu trên.\n" +
      "4. In kết quả ra Console.\n" +
      "5. Mỗi vòng lặp phải có kết quả riêng biệt." +
      COMMON_LOOP_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 01 (Vòng lặp): Dùng for, while và do...while để in các số từ 1 đến 10 (mỗi vòng lặp in riêng)\n`,
      "Bài 01. In dãy số tự nhiên",
    ),
    solutionCode: makeJsConsoleFiles(
      `console.log("--- Cách 1: for ---");\nfor (let i = 1; i <= 10; i++) {\n  console.log(i);\n}\n\nconsole.log("--- Cách 2: while ---");\nlet j = 1;\nwhile (j <= 10) {\n  console.log(j);\n  j++;\n}\n\nconsole.log("--- Cách 3: do...while ---");\nlet k = 1;\ndo {\n  console.log(k);\n  k++;\n} while (k <= 10);`,
      "Bài 01. In dãy số tự nhiên",
    ),
    criteria: [
      {
        id: "loop_b1_loops",
        type: "js_analysis",
        label: "Sử dụng đầy đủ cả 3 vòng lặp: for, while và do...while",
        selector: "js",
        property: "uses_loops",
        expected: "for,while,do_while",
        weight: 45,
      },
      {
        id: "loop_b1_console",
        type: "console_contains",
        label: "In đầy đủ các số tự nhiên từ 1 đến 10 ra Console",
        selector: "console",
        expected: "1&&2&&3&&4&&5&&6&&7&&8&&9&&10",
        weight: 30,
      },
      {
        id: "loop_b1_separate",
        type: "console_contains",
        label: "Mỗi vòng lặp in một lượt kết quả riêng biệt (đủ 3 lượt đến 10)",
        selector: "console",
        property: "min_matches",
        expected: "\\b10\\b",
        minCount: 3,
        weight: 15,
      },
      {
        id: "loop_b1_scope",
        type: "js_analysis",
        label: "Tuân thủ phạm vi bài 01–05 (chưa dùng mảng/hàm/DOM)",
        selector: "js",
        property: "no_arrays_funcs_dom",
        expected: "Chỉ dùng kiến thức bài 01–05",
        weight: 10,
      },
    ],
  },
  {
    id: "js-loop-02",
    label: "Bài 02. Tính tổng các số (Dễ · 100 điểm)",
    category: "JavaScript – Vòng lặp",
    difficulty: "Dễ",
    title: "Bài 02. Tính tổng các số",
    description:
      "Viết chương trình tính tổng các số nguyên từ 1 đến 100: S = 1 + 2 + 3 + ... + 100.\n\n" +
      "Tiêu chí:\n" +
      "1. Sử dụng vòng lặp for để tính tổng.\n" +
      "2. Sử dụng vòng lặp while để tính tổng.\n" +
      "3. Sử dụng vòng lặp do...while để tính tổng.\n" +
      "4. In tổng cuối cùng của mỗi cách tính.\n" +
      "5. Kết quả của cả ba cách phải giống nhau (5050)." +
      COMMON_LOOP_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 02 (Vòng lặp): Tính tổng S = 1 + 2 + ... + 100 bằng cả 3 cách: for, while, do...while\n`,
      "Bài 02. Tính tổng các số",
    ),
    solutionCode: makeJsConsoleFiles(
      `let tongFor = 0;\nfor (let i = 1; i <= 100; i++) {\n  tongFor += i;\n}\nconsole.log("Tổng (for):", tongFor);\n\nlet tongWhile = 0;\nlet j = 1;\nwhile (j <= 100) {\n  tongWhile += j;\n  j++;\n}\nconsole.log("Tổng (while):", tongWhile);\n\nlet tongDoWhile = 0;\nlet k = 1;\ndo {\n  tongDoWhile += k;\n  k++;\n} while (k <= 100);\nconsole.log("Tổng (do...while):", tongDoWhile);`,
      "Bài 02. Tính tổng các số",
    ),
    criteria: [
      {
        id: "loop_b2_loops",
        type: "js_analysis",
        label: "Sử dụng đầy đủ cả 3 vòng lặp: for, while và do...while",
        selector: "js",
        property: "uses_loops",
        expected: "for,while,do_while",
        weight: 45,
      },
      {
        id: "loop_b2_sum",
        type: "console_contains",
        label: "Tính đúng tổng từ 1 đến 100 là 5050 và in ra Console",
        selector: "console",
        property: "regex",
        expected: "5[.,]?050",
        weight: 25,
      },
      {
        id: "loop_b2_three",
        type: "console_contains",
        label: "In ra đủ 3 kết quả giống nhau (5050) cho 3 cách tính",
        selector: "console",
        property: "min_matches",
        expected: "5[.,]?050",
        minCount: 3,
        weight: 20,
      },
      {
        id: "loop_b2_scope",
        type: "js_analysis",
        label: "Tuân thủ phạm vi bài 01–05 (chưa dùng mảng/hàm/DOM)",
        selector: "js",
        property: "no_arrays_funcs_dom",
        expected: "Chỉ dùng kiến thức bài 01–05",
        weight: 10,
      },
    ],
  },
  {
    id: "js-loop-03",
    label: "Bài 03. Bảng cửu chương (Trung bình · 100 điểm)",
    category: "JavaScript – Vòng lặp",
    difficulty: "Trung bình",
    title: "Bài 03. Bảng cửu chương",
    description:
      "Viết chương trình in bảng cửu chương của số 7 (7 x 1 = 7 ... 7 x 10 = 70).\n\n" +
      "Tiêu chí:\n" +
      "1. Sử dụng vòng lặp for để in bảng cửu chương.\n" +
      "2. Sử dụng vòng lặp while để thực hiện lại.\n" +
      "3. Sử dụng vòng lặp do...while để thực hiện lại.\n" +
      "4. Mỗi phép tính phải được in thành một dòng.\n" +
      "5. Không viết thủ công từng phép tính." +
      COMMON_LOOP_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 03 (Vòng lặp): In bảng cửu chương số 7 (từ 7 x 1 = 7 đến 7 x 10 = 70) bằng for, while, do...while\n`,
      "Bài 03. Bảng cửu chương",
    ),
    solutionCode: makeJsConsoleFiles(
      `console.log("=== Bảng cửu chương 7 (for) ===");\nfor (let i = 1; i <= 10; i++) {\n  console.log("7 x " + i + " = " + 7 * i);\n}\n\nconsole.log("=== Bảng cửu chương 7 (while) ===");\nlet j = 1;\nwhile (j <= 10) {\n  console.log("7 x " + j + " = " + 7 * j);\n  j++;\n}\n\nconsole.log("=== Bảng cửu chương 7 (do...while) ===");\nlet k = 1;\ndo {\n  console.log("7 x " + k + " = " + 7 * k);\n  k++;\n} while (k <= 10);`,
      "Bài 03. Bảng cửu chương",
    ),
    criteria: [
      {
        id: "loop_b3_loops",
        type: "js_analysis",
        label: "Sử dụng đầy đủ cả 3 vòng lặp: for, while và do...while",
        selector: "js",
        property: "uses_loops",
        expected: "for,while,do_while",
        weight: 40,
      },
      {
        id: "loop_b3_lines",
        type: "console_contains",
        label: "In mỗi phép tính thành một dòng (tối thiểu 30 dòng cho 3 bảng)",
        selector: "console",
        property: "min_lines",
        expected: "30 dòng",
        minCount: 30,
        weight: 15,
      },
      {
        id: "loop_b3_values",
        type: "console_contains",
        label: "In đúng đủ 10 kết quả của bảng cửu chương 7 (7, 14, ..., 70)",
        selector: "console",
        property: "regex",
        expected: "\\b7\\b&&14&&21&&28&&35&&42&&49&&56&&63&&70",
        weight: 20,
      },
      {
        id: "loop_b3_three",
        type: "console_contains",
        label: "Cả 3 vòng lặp đều in hoàn chỉnh đến phép tính 7 x 10 = 70",
        selector: "console",
        property: "min_matches",
        expected: "\\b70\\b",
        minCount: 3,
        weight: 15,
      },
      {
        id: "loop_b3_scope",
        type: "js_analysis",
        label: "Tuân thủ phạm vi bài 01–05 (chưa dùng mảng/hàm/DOM)",
        selector: "js",
        property: "no_arrays_funcs_dom",
        expected: "Chỉ dùng kiến thức bài 01–05",
        weight: 10,
      },
    ],
  },
  {
    id: "js-loop-04",
    label: "Bài 04. Kiểm tra số nguyên tố (Trung bình · 100 điểm)",
    category: "JavaScript – Vòng lặp",
    difficulty: "Trung bình",
    title: "Bài 04. Kiểm tra số nguyên tố",
    description:
      "Viết chương trình kiểm tra một số nguyên dương có phải là số nguyên tố hay không.\n" +
      "- Số cần kiểm tra: 29.\n\n" +
      "Quy tắc: Số nguyên tố là số tự nhiên lớn hơn 1, chỉ chia hết cho 1 và chính nó.\n\n" +
      "Tiêu chí:\n" +
      "1. Sử dụng vòng lặp for để kiểm tra số nguyên tố.\n" +
      "2. Sử dụng vòng lặp while để thực hiện lại.\n" +
      "3. Sử dụng điều kiện if/else để xác định kết quả.\n" +
      "4. Kiểm tra trường hợp số nhỏ hơn hoặc bằng 1.\n" +
      "5. In thông báo số đã cho có phải số nguyên tố hay không." +
      COMMON_LOOP_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 04 (Vòng lặp): Kiểm tra số 29 có phải số nguyên tố bằng cả for và while\n`,
      "Bài 04. Kiểm tra số nguyên tố",
    ),
    solutionCode: makeJsConsoleFiles(
      `const n = 29;\n\nlet laSoNguyenToFor = true;\nif (n <= 1) {\n  laSoNguyenToFor = false;\n} else {\n  for (let i = 2; i < n; i++) {\n    if (n % i === 0) {\n      laSoNguyenToFor = false;\n      break;\n    }\n  }\n}\nif (laSoNguyenToFor) {\n  console.log("(for)", n, "là số nguyên tố");\n} else {\n  console.log("(for)", n, "không phải là số nguyên tố");\n}\n\nlet laSoNguyenToWhile = true;\nif (n <= 1) {\n  laSoNguyenToWhile = false;\n} else {\n  let j = 2;\n  while (j < n) {\n    if (n % j === 0) {\n      laSoNguyenToWhile = false;\n      break;\n    }\n    j++;\n  }\n}\nif (laSoNguyenToWhile) {\n  console.log("(while)", n, "là số nguyên tố");\n} else {\n  console.log("(while)", n, "không phải là số nguyên tố");\n}`,
      "Bài 04. Kiểm tra số nguyên tố",
    ),
    criteria: [
      {
        id: "loop_b4_loops",
        type: "js_analysis",
        label: "Sử dụng cả vòng lặp for và vòng lặp while để kiểm tra",
        selector: "js",
        property: "uses_loops",
        expected: "for,while",
        weight: 25,
      },
      {
        id: "loop_b4_ifelse",
        type: "js_analysis",
        label: "Sử dụng điều kiện if/else để xác định kết quả",
        selector: "js",
        property: "uses_if_else",
        expected: "if_else",
        weight: 15,
      },
      {
        id: "loop_b4_ops",
        type: "js_analysis",
        label: "Kiểm tra số <= 1 và dùng toán tử % kiểm tra chia hết",
        selector: "js",
        property: "has_operators",
        expected: "%,<=|<",
        minCount: 2,
        weight: 20,
      },
      {
        id: "loop_b4_console",
        type: "console_contains",
        label: "In thông báo đúng cho số 29 là số nguyên tố ra Console",
        selector: "console",
        property: "regex",
        expected: "29&&nguyên tố",
        weight: 30,
      },
      {
        id: "loop_b4_scope",
        type: "js_analysis",
        label: "Tuân thủ phạm vi bài 01–05 (chưa dùng mảng/hàm/DOM)",
        selector: "js",
        property: "no_arrays_funcs_dom",
        expected: "Chỉ dùng kiến thức bài 01–05",
        weight: 10,
      },
    ],
  },
  {
    id: "js-loop-05",
    label: "Bài 05. Hệ thống đăng nhập tài khoản (Khá · 100 điểm)",
    category: "JavaScript – Vòng lặp",
    difficulty: "Khá",
    title: "Bài 05. Hệ thống đăng nhập tài khoản",
    description:
      "Viết chương trình mô phỏng hệ thống đăng nhập tài khoản bằng JavaScript.\n\n" +
      "Thông tin tài khoản:\n" +
      "- Tên đăng nhập đúng: admin.\n" +
      "- Mật khẩu đúng: 123456.\n" +
      "- Số lần nhập tối đa: 3.\n" +
      "- Số lần nhập hiện tại: 0.\n\n" +
      "Tiêu chí:\n" +
      "1. Sử dụng while (hoặc do...while) để mô phỏng quá trình đăng nhập.\n" +
      "2. Sử dụng if/else để kiểm tra thông tin đăng nhập.\n" +
      "3. Sử dụng toán tử && để kiểm tra đồng thời tên đăng nhập và mật khẩu.\n" +
      "4. Sử dụng biến đếm để quản lý số lần đăng nhập.\n" +
      "5. Dừng vòng lặp khi đăng nhập thành công hoặc hết số lần cho phép.\n" +
      "Lưu ý: Mô phỏng dữ liệu nhập bằng các biến có sẵn, chưa cần dùng HTML hoặc DOM." +
      COMMON_LOOP_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 05 (Vòng lặp): Mô phỏng hệ thống đăng nhập (admin / 123456, tối đa 3 lần) bằng while/do...while + if/else + &&\n`,
      "Bài 05. Hệ thống đăng nhập tài khoản",
    ),
    solutionCode: makeJsConsoleFiles(
      `const tenDangNhapDung = "admin";\nconst matKhauDung = "123456";\nconst soLanToiDa = 3;\nlet soLanNhap = 0;\nlet daDangNhap = false;\n\nwhile (soLanNhap < soLanToiDa) {\n  soLanNhap++;\n  let tenNhap = soLanNhap === 3 ? "admin" : "guest";\n  let mkNhap = soLanNhap === 3 ? "123456" : "000000";\n\n  if (tenNhap === tenDangNhapDung && mkNhap === matKhauDung) {\n    console.log("Lần " + soLanNhap + ": Đăng nhập thành công!");\n    daDangNhap = true;\n    break;\n  } else {\n    console.log("Lần " + soLanNhap + ": Thông tin không chính xác.");\n  }\n}\n\nif (!daDangNhap) {\n  console.log("Tài khoản bị khóa do nhập sai quá " + soLanToiDa + " lần!");\n}`,
      "Bài 05. Hệ thống đăng nhập tài khoản",
    ),
    criteria: [
      {
        id: "loop_b5_loop",
        type: "js_analysis",
        label: "Sử dụng vòng lặp while (hoặc do...while) để mô phỏng quá trình đăng nhập",
        selector: "js",
        property: "uses_loops",
        expected: "while,do_while",
        minCount: 1,
        weight: 25,
      },
      {
        id: "loop_b5_ifelse",
        type: "js_analysis",
        label: "Sử dụng if/else để kiểm tra thông tin đăng nhập",
        selector: "js",
        property: "uses_if_else",
        expected: "if_else",
        weight: 20,
      },
      {
        id: "loop_b5_logic",
        type: "js_analysis",
        label: "Sử dụng toán tử && kiểm tra đồng thời tên đăng nhập và mật khẩu",
        selector: "js",
        property: "has_operators",
        expected: "&&",
        weight: 20,
      },
      {
        id: "loop_b5_console",
        type: "console_contains",
        label: "In thông báo kết quả đăng nhập (thành công hoặc bị khóa) ra Console",
        selector: "console",
        property: "regex",
        expected: "(?:thành công|bị khóa)",
        weight: 25,
      },
      {
        id: "loop_b5_scope",
        type: "js_analysis",
        label: "Tuân thủ phạm vi bài 01–05 (chưa dùng mảng/hàm/DOM)",
        selector: "js",
        property: "no_arrays_funcs_dom",
        expected: "Chỉ dùng kiến thức bài 01–05",
        weight: 10,
      },
    ],
  },
  // ─── 06. HÀM (FUNCTION) ───────────────────────────────────────────────
  {
    id: "js-fn-01",
    label: "Bài 01. Hàm tính tổng hai số (Dễ · 100 điểm)",
    category: "JavaScript – Hàm (Function)",
    difficulty: "Dễ",
    title: "Bài 01. Hàm tính tổng hai số",
    description:
      "Viết hàm tinhTong(a, b) nhận vào hai số và trả về tổng của chúng.\n\n" +
      "Dữ liệu mẫu:\n" +
      "- Số thứ nhất: 15.\n" +
      "- Số thứ hai: 25.\n\n" +
      "Tiêu chí:\n" +
      "1. Khai báo hàm có hai tham số.\n" +
      "2. Sử dụng return để trả về kết quả.\n" +
      "3. Gọi hàm với các giá trị khác nhau.\n" +
      "4. In kết quả ra Console." +
      COMMON_FN_ARR_OBJ_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 01 (Function): Viết hàm tinhTong(a, b) dùng return và gọi với dữ liệu mẫu (15, 25) cùng các giá trị khác\n`,
      "Bài 01. Hàm tính tổng hai số",
    ),
    solutionCode: makeJsConsoleFiles(
      `function tinhTong(a, b) {\n  return a + b;\n}\n\nconsole.log("Tổng 15 + 25 =", tinhTong(15, 25));\nconsole.log("Tổng 10 + 20 =", tinhTong(10, 20));\nconsole.log("Tổng -5 + 12 =", tinhTong(-5, 12));`,
      "Bài 01. Hàm tính tổng hai số",
    ),
    criteria: [
      {
        id: "fn_b1_decl",
        type: "js_analysis",
        label: "Khai báo hàm và sử dụng return trả về kết quả",
        selector: "js",
        property: "uses_functions",
        expected: "return",
        minCount: 1,
        weight: 30,
      },
      {
        id: "fn_b1_sample",
        type: "console_contains",
        label: "Gọi hàm với bộ dữ liệu mẫu (15, 25) trả về đúng 40",
        selector: "console",
        expected: "40",
        weight: 30,
      },
      {
        id: "fn_b1_calls",
        type: "console_contains",
        label: "Gọi hàm với nhiều bộ giá trị khác nhau và in ra Console (>= 2 dòng)",
        selector: "console",
        property: "min_lines",
        expected: "2 dòng",
        minCount: 2,
        weight: 30,
      },
      {
        id: "fn_b1_scope",
        type: "js_analysis",
        label: "Thực thi logic thuần JavaScript trên Console",
        selector: "js",
        property: "no_dom",
        expected: "Không dùng DOM",
        weight: 10,
      },
    ],
  },
  {
    id: "js-fn-02",
    label: "Bài 02. Hàm tính diện tích hình chữ nhật (Dễ · 100 điểm)",
    category: "JavaScript – Hàm (Function)",
    difficulty: "Dễ",
    title: "Bài 02. Hàm tính diện tích hình chữ nhật",
    description:
      "Viết hàm tinhDienTich(chieuDai, chieuRong) để tính diện tích hình chữ nhật.\n\n" +
      "Dữ liệu mẫu:\n" +
      "- Chiều dài: 10.\n" +
      "- Chiều rộng: 5.\n\n" +
      "Tiêu chí:\n" +
      "1. Hàm nhận hai tham số.\n" +
      "2. Tính diện tích bằng công thức chiều dài × chiều rộng.\n" +
      "3. Trả kết quả bằng return.\n" +
      "4. Kiểm tra trường hợp chiều dài hoặc chiều rộng nhỏ hơn hoặc bằng 0.\n" +
      "5. Gọi hàm ít nhất 3 lần với dữ liệu khác nhau." +
      COMMON_FN_ARR_OBJ_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 02 (Function): Viết hàm tinhDienTich(chieuDai, chieuRong), kiểm tra <= 0, dùng return và gọi ít nhất 3 lần\n`,
      "Bài 02. Hàm tính diện tích hình chữ nhật",
    ),
    solutionCode: makeJsConsoleFiles(
      `function tinhDienTich(chieuDai, chieuRong) {\n  if (chieuDai <= 0 || chieuRong <= 0) {\n    return "Chiều dài và chiều rộng phải lớn hơn 0";\n  }\n  return chieuDai * chieuRong;\n}\n\nconsole.log("Diện tích (10, 5):", tinhDienTich(10, 5));\nconsole.log("Diện tích (8, 4):", tinhDienTich(8, 4));\nconsole.log("Diện tích (-2, 5):", tinhDienTich(-2, 5));`,
      "Bài 02. Hàm tính diện tích hình chữ nhật",
    ),
    criteria: [
      {
        id: "fn_b2_decl",
        type: "js_analysis",
        label: "Khai báo hàm và trả về diện tích bằng return",
        selector: "js",
        property: "uses_functions",
        expected: "return",
        minCount: 1,
        weight: 25,
      },
      {
        id: "fn_b2_check",
        type: "js_analysis",
        label: "Kiểm tra điều kiện chiều dài hoặc chiều rộng <= 0 bằng if",
        selector: "js",
        property: "uses_if_else",
        expected: "if",
        weight: 20,
      },
      {
        id: "fn_b2_sample",
        type: "console_contains",
        label: "Tính đúng diện tích dữ liệu mẫu (10 x 5 = 50)",
        selector: "console",
        expected: "50",
        weight: 25,
      },
      {
        id: "fn_b2_calls",
        type: "console_contains",
        label: "Gọi hàm ít nhất 3 lần với dữ liệu khác nhau (>= 3 dòng Console)",
        selector: "console",
        property: "min_lines",
        expected: "3 dòng",
        minCount: 3,
        weight: 20,
      },
      {
        id: "fn_b2_scope",
        type: "js_analysis",
        label: "Thực thi logic thuần JavaScript trên Console",
        selector: "js",
        property: "no_dom",
        expected: "Không dùng DOM",
        weight: 10,
      },
    ],
  },
  {
    id: "js-fn-03",
    label: "Bài 03. Hàm tính điểm trung bình (Trung bình · 100 điểm)",
    category: "JavaScript – Hàm (Function)",
    difficulty: "Trung bình",
    title: "Bài 03. Hàm tính điểm trung bình",
    description:
      "Viết hàm tinhDiemTrungBinh(toan, ly, hoa) để tính điểm trung bình của sinh viên.\n\n" +
      "Dữ liệu mẫu:\n" +
      "- Toán: 8.\n" +
      "- Lý: 7.5.\n" +
      "- Hóa: 9.\n\n" +
      "Tiêu chí:\n" +
      "1. Hàm nhận 3 tham số.\n" +
      "2. Tính điểm trung bình của 3 môn.\n" +
      "3. Sử dụng return trả về kết quả.\n" +
      "4. Viết thêm hàm xepLoai(diemTrungBinh) để xếp loại (Xuất sắc >= 9, Giỏi >= 8, Khá >= 6.5, Trung bình >= 5, dưới 5 Yếu).\n" +
      "5. Gọi hai hàm để hiển thị điểm và xếp loại." +
      COMMON_FN_ARR_OBJ_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 03 (Function): Viết tinhDiemTrungBinh(toan, ly, hoa) và xepLoai(dtb), dùng return và gọi hiển thị kết quả\n`,
      "Bài 03. Hàm tính điểm trung bình",
    ),
    solutionCode: makeJsConsoleFiles(
      `function tinhDiemTrungBinh(toan, ly, hoa) {\n  return (toan + ly + hoa) / 3;\n}\n\nfunction xepLoai(dtb) {\n  if (dtb >= 9) return "Xuất sắc";\n  else if (dtb >= 8) return "Giỏi";\n  else if (dtb >= 6.5) return "Khá";\n  else if (dtb >= 5) return "Trung bình";\n  else return "Yếu";\n}\n\nconst dtb = tinhDiemTrungBinh(8, 7.5, 9);\nconsole.log("Điểm trung bình:", dtb.toFixed(2));\nconsole.log("Xếp loại:", xepLoai(dtb));`,
      "Bài 03. Hàm tính điểm trung bình",
    ),
    criteria: [
      {
        id: "fn_b3_decl",
        type: "js_analysis",
        label: "Viết đầy đủ 2 hàm (tính điểm trung bình & xếp loại) đều dùng return",
        selector: "js",
        property: "uses_functions",
        expected: "return",
        minCount: 2,
        weight: 30,
      },
      {
        id: "fn_b3_ifelse",
        type: "js_analysis",
        label: "Dùng if / else if / else trong hàm xếp loại",
        selector: "js",
        property: "uses_if_else",
        expected: "else_if",
        weight: 20,
      },
      {
        id: "fn_b3_console",
        type: "console_contains",
        label: "Hiển thị điểm trung bình (~8.17) và xếp loại (Giỏi) ra Console",
        selector: "console",
        property: "regex",
        expected: "8[.,]1[67]&&giỏi",
        weight: 40,
      },
      {
        id: "fn_b3_scope",
        type: "js_analysis",
        label: "Thực thi logic thuần JavaScript trên Console",
        selector: "js",
        property: "no_dom",
        expected: "Không dùng DOM",
        weight: 10,
      },
    ],
  },
  {
    id: "js-fn-04",
    label: "Bài 04. Hàm kiểm tra số nguyên tố (Trung bình · 100 điểm)",
    category: "JavaScript – Hàm (Function)",
    difficulty: "Trung bình",
    title: "Bài 04. Hàm kiểm tra số nguyên tố",
    description:
      "Viết hàm kiemTraSoNguyenTo(n) để kiểm tra một số có phải số nguyên tố hay không.\n\n" +
      "Dữ liệu mẫu: 7, 12, 17, 25.\n\n" +
      "Tiêu chí:\n" +
      "1. Hàm nhận một tham số.\n" +
      "2. Sử dụng vòng lặp để kiểm tra số nguyên tố.\n" +
      "3. Sử dụng if/else để xử lý kết quả.\n" +
      "4. Trả về true nếu là số nguyên tố, ngược lại trả về false.\n" +
      "5. Gọi hàm với ít nhất 4 giá trị khác nhau." +
      COMMON_FN_ARR_OBJ_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 04 (Function): Viết hàm kiemTraSoNguyenTo(n) trả về true/false và gọi với 7, 12, 17, 25\n`,
      "Bài 04. Hàm kiểm tra số nguyên tố",
    ),
    solutionCode: makeJsConsoleFiles(
      `function kiemTraSoNguyenTo(n) {\n  if (n <= 1) {\n    return false;\n  } else {\n    for (let i = 2; i < n; i++) {\n      if (n % i === 0) return false;\n    }\n    return true;\n  }\n}\n\nconsole.log("7 có phải số nguyên tố:", kiemTraSoNguyenTo(7));\nconsole.log("12 có phải số nguyên tố:", kiemTraSoNguyenTo(12));\nconsole.log("17 có phải số nguyên tố:", kiemTraSoNguyenTo(17));\nconsole.log("25 có phải số nguyên tố:", kiemTraSoNguyenTo(25));`,
      "Bài 04. Hàm kiểm tra số nguyên tố",
    ),
    criteria: [
      {
        id: "fn_b4_decl",
        type: "js_analysis",
        label: "Khai báo hàm kiểm tra và dùng return trả về kết quả",
        selector: "js",
        property: "uses_functions",
        expected: "return",
        minCount: 1,
        weight: 20,
      },
      {
        id: "fn_b4_loop",
        type: "js_analysis",
        label: "Sử dụng vòng lặp (for hoặc while) kiểm tra ước số",
        selector: "js",
        property: "uses_loops",
        expected: "for,while",
        minCount: 1,
        weight: 20,
      },
      {
        id: "fn_b4_ifelse",
        type: "js_analysis",
        label: "Sử dụng if / else để xử lý điều kiện số nguyên tố",
        selector: "js",
        property: "uses_if_else",
        expected: "if_else",
        weight: 15,
      },
      {
        id: "fn_b4_bools",
        type: "console_contains",
        label: "Trả về đúng giá trị boolean true (7, 17) và false (12, 25)",
        selector: "console",
        expected: "true&&false",
        weight: 15,
      },
      {
        id: "fn_b4_lines",
        type: "console_contains",
        label: "Gọi hàm kiểm tra với ít nhất 4 giá trị khác nhau (>= 4 dòng)",
        selector: "console",
        property: "min_lines",
        expected: "4 dòng",
        minCount: 4,
        weight: 20,
      },
      {
        id: "fn_b4_scope",
        type: "js_analysis",
        label: "Thực thi logic thuần JavaScript trên Console",
        selector: "js",
        property: "no_dom",
        expected: "Không dùng DOM",
        weight: 10,
      },
    ],
  },
  {
    id: "js-fn-05",
    label: "Bài 05. Xây dựng máy tính bằng Function (Khá · 100 điểm)",
    category: "JavaScript – Hàm (Function)",
    difficulty: "Khá",
    title: "Bài 05. Xây dựng máy tính bằng Function",
    description:
      "Xây dựng chương trình máy tính sử dụng các hàm riêng biệt.\n\n" +
      "Các phép tính: Cộng, Trừ, Nhân, Chia, Tính phần dư.\n\n" +
      "Tiêu chí:\n" +
      "1. Viết 5 hàm tương ứng với 5 phép tính.\n" +
      "2. Mỗi hàm nhận hai tham số.\n" +
      "3. Mỗi hàm sử dụng return.\n" +
      "4. Kiểm tra trường hợp chia cho 0.\n" +
      "5. Gọi các hàm với nhiều bộ dữ liệu khác nhau.\n" +
      "6. In kết quả từng phép tính ra Console." +
      COMMON_FN_ARR_OBJ_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 05 (Function): Viết 5 hàm riêng cho Cộng, Trừ, Nhân, Chia (kiểm tra chia cho 0), Phần dư và gọi in kết quả\n`,
      "Bài 05. Xây dựng máy tính bằng Function",
    ),
    solutionCode: makeJsConsoleFiles(
      `function cong(a, b) { return a + b; }\nfunction tru(a, b) { return a - b; }\nfunction nhan(a, b) { return a * b; }\nfunction chia(a, b) {\n  if (b === 0) return "Không thể chia cho 0";\n  return a / b;\n}\nfunction chiaLayDu(a, b) {\n  if (b === 0) return "Không thể chia cho 0";\n  return a % b;\n}\n\nconsole.log("20 + 6 =", cong(20, 6));\nconsole.log("20 - 6 =", tru(20, 6));\nconsole.log("20 * 6 =", nhan(20, 6));\nconsole.log("20 / 4 =", chia(20, 4));\nconsole.log("20 / 0 =", chia(20, 0));\nconsole.log("20 % 6 =", chiaLayDu(20, 6));`,
      "Bài 05. Xây dựng máy tính bằng Function",
    ),
    criteria: [
      {
        id: "fn_b5_decl",
        type: "js_analysis",
        label: "Viết đủ 5 hàm riêng biệt cho 5 phép tính và đều dùng return",
        selector: "js",
        property: "uses_functions",
        expected: "return",
        minCount: 5,
        weight: 30,
      },
      {
        id: "fn_b5_ops",
        type: "js_analysis",
        label: "Thực hiện đầy đủ 5 phép toán +, -, *, /, %",
        selector: "js",
        property: "has_operators",
        expected: "+,-,*,/,%",
        weight: 25,
      },
      {
        id: "fn_b5_zero",
        type: "js_analysis",
        label: "Kiểm tra trường hợp chia cho 0 bằng câu lệnh if",
        selector: "js",
        property: "uses_if_else",
        expected: "if",
        weight: 15,
      },
      {
        id: "fn_b5_lines",
        type: "console_contains",
        label: "Gọi các hàm và in kết quả từng phép tính ra Console (>= 5 dòng)",
        selector: "console",
        property: "min_lines",
        expected: "5 dòng",
        minCount: 5,
        weight: 20,
      },
      {
        id: "fn_b5_scope",
        type: "js_analysis",
        label: "Thực thi logic thuần JavaScript trên Console",
        selector: "js",
        property: "no_dom",
        expected: "Không dùng DOM",
        weight: 10,
      },
    ],
  },
  // ─── 07. MẢNG (ARRAY) ──────────────────────────────────────────────────
  {
    id: "js-arr-01",
    label: "Bài 01. Quản lý danh sách sinh viên (Dễ · 100 điểm)",
    category: "JavaScript – Mảng (Array)",
    difficulty: "Dễ",
    title: "Bài 01. Quản lý danh sách sinh viên",
    description:
      "Tạo một mảng lưu trữ danh sách 5 sinh viên:\n" +
      "- Nguyễn Văn An, Trần Minh Tuấn, Lê Thị Mai, Phạm Văn Hùng, Nguyễn Thị Hoa.\n\n" +
      "Tiêu chí:\n" +
      "1. Khai báo mảng chứa 5 tên sinh viên.\n" +
      "2. In toàn bộ danh sách ra Console.\n" +
      "3. In sinh viên đầu tiên và cuối cùng.\n" +
      "4. In số lượng sinh viên trong mảng.\n" +
      "5. Thêm một sinh viên mới bằng push().\n" +
      "6. Xóa sinh viên cuối cùng bằng pop()." +
      COMMON_FN_ARR_OBJ_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 01 (Array): Quản lý mảng 5 sinh viên với push(), pop() và in kết quả ra Console\n`,
      "Bài 01. Quản lý danh sách sinh viên",
    ),
    solutionCode: makeJsConsoleFiles(
      `const sinhVien = ["Nguyễn Văn An", "Trần Minh Tuấn", "Lê Thị Mai", "Phạm Văn Hùng", "Nguyễn Thị Hoa"];\n\nconsole.log("Danh sách ban đầu:", sinhVien);\nconsole.log("Sinh viên đầu tiên:", sinhVien[0]);\nconsole.log("Sinh viên cuối cùng:", sinhVien[sinhVien.length - 1]);\nconsole.log("Số lượng sinh viên:", sinhVien.length);\n\nsinhVien.push("Vũ Hoàng Nam");\nconsole.log("Sau khi push:", sinhVien);\n\nsinhVien.pop();\nconsole.log("Sau khi pop:", sinhVien);`,
      "Bài 01. Quản lý danh sách sinh viên",
    ),
    criteria: [
      {
        id: "arr_b1_methods",
        type: "js_analysis",
        label: "Khai báo mảng và sử dụng push(), pop() để thêm/xóa phần tử",
        selector: "js",
        property: "uses_array_methods",
        expected: "push,pop",
        weight: 30,
      },
      {
        id: "arr_b1_console",
        type: "console_contains",
        label: "In danh sách, sinh viên đầu (Nguyễn Văn An), cuối (Nguyễn Thị Hoa) và số lượng (5)",
        selector: "console",
        expected: "Nguyễn Văn An&&Nguyễn Thị Hoa&&5",
        weight: 40,
      },
      {
        id: "arr_b1_lines",
        type: "console_contains",
        label: "In kết quả rõ ràng sau các bước thao tác (>= 4 dòng)",
        selector: "console",
        property: "min_lines",
        expected: "4 dòng",
        minCount: 4,
        weight: 20,
      },
      {
        id: "arr_b1_scope",
        type: "js_analysis",
        label: "Thực thi logic thuần JavaScript trên Console",
        selector: "js",
        property: "no_dom",
        expected: "Không dùng DOM",
        weight: 10,
      },
    ],
  },
  {
    id: "js-arr-02",
    label: "Bài 02. Quản lý danh sách sản phẩm (Dễ · 100 điểm)",
    category: "JavaScript – Mảng (Array)",
    difficulty: "Dễ",
    title: "Bài 02. Quản lý danh sách sản phẩm",
    description:
      'Tạo mảng chứa danh sách sản phẩm: ["Laptop", "Điện thoại", "Máy tính bảng", "Tai nghe"].\n\n' +
      "Thực hiện các thao tác:\n" +
      '1. Thêm sản phẩm "Đồng hồ" vào cuối danh sách.\n' +
      '2. Thêm sản phẩm "Bàn phím" vào đầu danh sách.\n' +
      "3. Xóa sản phẩm cuối cùng.\n" +
      "4. Xóa sản phẩm đầu tiên.\n" +
      '5. Kiểm tra danh sách có chứa "Laptop" không.\n' +
      '6. Tìm vị trí của sản phẩm "Tai nghe".\n\n' +
      "Tiêu chí:\n" +
      "- Sử dụng push(), pop(), shift(), unshift(), includes(), indexOf().\n" +
      "- In danh sách sau mỗi thao tác." +
      COMMON_FN_ARR_OBJ_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 02 (Array): Dùng push(), unshift(), pop(), shift(), includes(), indexOf() trên mảng sản phẩm\n`,
      "Bài 02. Quản lý danh sách sản phẩm",
    ),
    solutionCode: makeJsConsoleFiles(
      `const sanPham = ["Laptop", "Điện thoại", "Máy tính bảng", "Tai nghe"];\n\nsanPham.push("Đồng hồ");\nconsole.log("1. Sau push:", sanPham);\n\nsanPham.unshift("Bàn phím");\nconsole.log("2. Sau unshift:", sanPham);\n\nsanPham.pop();\nconsole.log("3. Sau pop:", sanPham);\n\nsanPham.shift();\nconsole.log("4. Sau shift:", sanPham);\n\nconsole.log("5. Có chứa Laptop:", sanPham.includes("Laptop"));\nconsole.log("6. Vị trí của Tai nghe:", sanPham.indexOf("Tai nghe"));`,
      "Bài 02. Quản lý danh sách sản phẩm",
    ),
    criteria: [
      {
        id: "arr_b2_mut",
        type: "js_analysis",
        label: "Sử dụng đầy đủ push(), pop(), shift(), unshift()",
        selector: "js",
        property: "uses_array_methods",
        expected: "push,pop,shift,unshift",
        weight: 35,
      },
      {
        id: "arr_b2_search",
        type: "js_analysis",
        label: "Sử dụng includes() và indexOf() để tìm kiếm",
        selector: "js",
        property: "uses_array_methods",
        expected: "includes,indexOf",
        weight: 25,
      },
      {
        id: "arr_b2_console",
        type: "console_contains",
        label: "In đầy đủ kết quả các thao tác (Đồng hồ, Bàn phím, Laptop, true, vị trí 3)",
        selector: "console",
        expected: "Đồng hồ&&Bàn phím&&Laptop&&true&&3",
        weight: 30,
      },
      {
        id: "arr_b2_scope",
        type: "js_analysis",
        label: "Thực thi logic thuần JavaScript trên Console",
        selector: "js",
        property: "no_dom",
        expected: "Không dùng DOM",
        weight: 10,
      },
    ],
  },
  {
    id: "js-arr-03",
    label: "Bài 03. Tính toán điểm sinh viên (Trung bình · 100 điểm)",
    category: "JavaScript – Mảng (Array)",
    difficulty: "Trung bình",
    title: "Bài 03. Tính toán điểm sinh viên",
    description:
      "Tạo mảng điểm của một sinh viên: [8, 7.5, 9, 6.5, 10, 5].\n\n" +
      "Thực hiện:\n" +
      "1. Tính tổng điểm.\n" +
      "2. Tính điểm trung bình.\n" +
      "3. Tìm điểm cao nhất và thấp nhất.\n" +
      "4. Đếm số môn đạt từ 8 điểm trở lên.\n" +
      "5. Tạo mảng mới chỉ chứa các môn >= 8 điểm và mảng biến đổi bằng map().\n\n" +
      "Tiêu chí:\n" +
      "- Sử dụng vòng lặp để duyệt mảng.\n" +
      "- Sử dụng filter() và map().\n" +
      "- Không viết thủ công từng phần tử." +
      COMMON_FN_ARR_OBJ_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 03 (Array): Duyệt mảng [8, 7.5, 9, 6.5, 10, 5] bằng vòng lặp, filter() và map()\n`,
      "Bài 03. Tính toán điểm sinh viên",
    ),
    solutionCode: makeJsConsoleFiles(
      `const diem = [8, 7.5, 9, 6.5, 10, 5];\nlet tong = 0;\nlet max = diem[0];\nlet min = diem[0];\nlet soMonGioi = 0;\n\nfor (let i = 0; i < diem.length; i++) {\n  tong += diem[i];\n  if (diem[i] > max) max = diem[i];\n  if (diem[i] < min) min = diem[i];\n  if (diem[i] >= 8) soMonGioi++;\n}\n\nconst diemTB = tong / diem.length;\nconst monTren8 = diem.filter((d) => d >= 8);\nconst diemQuyDoi = diem.map((d) => d * 10);\n\nconsole.log("Tổng điểm:", tong);\nconsole.log("Điểm trung bình:", diemTB.toFixed(2));\nconsole.log("Điểm cao nhất:", max, "| Thấp nhất:", min);\nconsole.log("Số môn >= 8:", soMonGioi);\nconsole.log("Các môn >= 8:", monTren8);\nconsole.log("Điểm hệ 100 (map):", diemQuyDoi);`,
      "Bài 03. Tính toán điểm sinh viên",
    ),
    criteria: [
      {
        id: "arr_b3_methods",
        type: "js_analysis",
        label: "Sử dụng filter() và map() trên mảng điểm",
        selector: "js",
        property: "uses_array_methods",
        expected: "filter,map",
        weight: 30,
      },
      {
        id: "arr_b3_loop",
        type: "js_analysis",
        label: "Sử dụng vòng lặp (for hoặc while) duyệt mảng",
        selector: "js",
        property: "uses_loops",
        expected: "for,while",
        minCount: 1,
        weight: 15,
      },
      {
        id: "arr_b3_console",
        type: "console_contains",
        label: "In đúng tổng (46), trung bình (~7.67), max (10), min (5), số môn >= 8 (3)",
        selector: "console",
        property: "regex",
        expected: "46&&7[.,]6[67]&&10&&5&&3",
        weight: 45,
      },
      {
        id: "arr_b3_scope",
        type: "js_analysis",
        label: "Thực thi logic thuần JavaScript trên Console",
        selector: "js",
        property: "no_dom",
        expected: "Không dùng DOM",
        weight: 10,
      },
    ],
  },
  {
    id: "js-arr-04",
    label: "Bài 04. Tìm kiếm và quản lý kho hàng (Trung bình · 100 điểm)",
    category: "JavaScript – Mảng (Array)",
    difficulty: "Trung bình",
    title: "Bài 04. Tìm kiếm và quản lý kho hàng",
    description:
      'Tạo mảng sản phẩm: ["Laptop", "Chuột", "Bàn phím", "Màn hình", "Tai nghe", "Webcam"].\n\n' +
      "Thực hiện:\n" +
      '1. Kiểm tra sản phẩm "Chuột" có trong kho không.\n' +
      '2. Tìm vị trí sản phẩm "Màn hình".\n' +
      '3. Xóa sản phẩm "Bàn phím".\n' +
      '4. Thêm sản phẩm "Loa" vào vị trí thứ 2.\n' +
      '5. Thay thế "Webcam" bằng "Microphone".\n' +
      "6. In danh sách sau khi cập nhật.\n\n" +
      "Tiêu chí:\n" +
      "- Sử dụng includes(), indexOf(), splice(), vòng lặp duyệt mảng và xử lý trường hợp không tìm thấy." +
      COMMON_FN_ARR_OBJ_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 04 (Array): Tìm kiếm và cập nhật kho hàng dùng includes(), indexOf(), splice() và vòng lặp\n`,
      "Bài 04. Tìm kiếm và quản lý kho hàng",
    ),
    solutionCode: makeJsConsoleFiles(
      `const kho = ["Laptop", "Chuột", "Bàn phím", "Màn hình", "Tai nghe", "Webcam"];\n\nconsole.log("Có Chuột trong kho:", kho.includes("Chuột"));\nconst viTriManHinh = kho.indexOf("Màn hình");\nif (viTriManHinh !== -1) {\n  console.log("Vị trí Màn hình:", viTriManHinh);\n} else {\n  console.log("Không tìm thấy Màn hình");\n}\n\nconst viTriBanPhim = kho.indexOf("Bàn phím");\nif (viTriBanPhim !== -1) kho.splice(viTriBanPhim, 1);\n\nkho.splice(2, 0, "Loa");\n\nconst viTriWebcam = kho.indexOf("Webcam");\nif (viTriWebcam !== -1) kho.splice(viTriWebcam, 1, "Microphone");\n\nconsole.log("Kho hàng sau cập nhật:");\nfor (let i = 0; i < kho.length; i++) {\n  console.log((i + 1) + ".", kho[i]);\n}`,
      "Bài 04. Tìm kiếm và quản lý kho hàng",
    ),
    criteria: [
      {
        id: "arr_b4_methods",
        type: "js_analysis",
        label: "Sử dụng đầy đủ includes(), indexOf(), splice()",
        selector: "js",
        property: "uses_array_methods",
        expected: "includes,indexOf,splice",
        weight: 30,
      },
      {
        id: "arr_b4_loop",
        type: "js_analysis",
        label: "Sử dụng vòng lặp (for hoặc while) để duyệt in kho hàng",
        selector: "js",
        property: "uses_loops",
        expected: "for,while",
        minCount: 1,
        weight: 15,
      },
      {
        id: "arr_b4_ifelse",
        type: "js_analysis",
        label: "Kiểm tra điều kiện xử lý trường hợp không tìm thấy sản phẩm",
        selector: "js",
        property: "uses_if_else",
        expected: "if",
        weight: 15,
      },
      {
        id: "arr_b4_console",
        type: "console_contains",
        label: "In kết quả kiểm tra (true, vị trí 3) và danh sách mới (có Loa, Microphone)",
        selector: "console",
        expected: "true&&3&&Loa&&Microphone",
        weight: 30,
      },
      {
        id: "arr_b4_scope",
        type: "js_analysis",
        label: "Thực thi logic thuần JavaScript trên Console",
        selector: "js",
        property: "no_dom",
        expected: "Không dùng DOM",
        weight: 10,
      },
    ],
  },
  {
    id: "js-arr-05",
    label: "Bài 05. Hệ thống quản lý điểm sinh viên (Khá · 100 điểm)",
    category: "JavaScript – Mảng (Array)",
    difficulty: "Khá",
    title: "Bài 05. Hệ thống quản lý điểm sinh viên",
    description:
      "Tạo mảng điểm: [5.5, 8, 9, 4, 7.5, 6, 10, 3.5, 8.5, 6.5].\n\n" +
      "Xây dựng chương trình thực hiện:\n" +
      "1. In toàn bộ danh sách điểm.\n" +
      "2. Tính điểm trung bình.\n" +
      "3. Tìm điểm cao nhất và thấp nhất.\n" +
      "4. Đếm số sinh viên đạt từ 5 điểm trở lên.\n" +
      "5. Tạo mảng sinh viên đạt yêu cầu (>= 5) và mảng chưa đạt (< 5).\n" +
      "6. Tạo mảng điểm mới tăng thêm 0.5 điểm cho mỗi phần tử.\n" +
      "7. Tìm tất cả vị trí có điểm bằng 8.\n\n" +
      "Tiêu chí:\n" +
      "- Sử dụng forEach() hoặc vòng lặp for, kết hợp map() và filter()." +
      COMMON_FN_ARR_OBJ_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 05 (Array): Quản lý mảng 10 điểm với forEach/for, filter() và map()\n`,
      "Bài 05. Hệ thống quản lý điểm sinh viên",
    ),
    solutionCode: makeJsConsoleFiles(
      `const diemSV = [5.5, 8, 9, 4, 7.5, 6, 10, 3.5, 8.5, 6.5];\nconsole.log("Danh sách điểm:", diemSV);\n\nlet tong = 0;\nlet max = diemSV[0];\nlet min = diemSV[0];\nconst viTriDiem8 = [];\n\ndiemSV.forEach((d, idx) => {\n  tong += d;\n  if (d > max) max = d;\n  if (d < min) min = d;\n  if (d === 8) viTriDiem8.push(idx);\n});\n\nconst diemTB = tong / diemSV.length;\nconst dsDat = diemSV.filter((d) => d >= 5);\nconst dsChuaDat = diemSV.filter((d) => d < 5);\nconst dsTangDiem = diemSV.map((d) => d + 0.5);\n\nconsole.log("Điểm trung bình:", diemTB.toFixed(2));\nconsole.log("Cao nhất:", max, "| Thấp nhất:", min);\nconsole.log("Số SV đạt >= 5:", dsDat.length, "| Đạt:", dsDat);\nconsole.log("Chưa đạt (< 5):", dsChuaDat);\nconsole.log("Mảng tăng +0.5:", dsTangDiem);\nconsole.log("Vị trí điểm 8:", viTriDiem8);`,
      "Bài 05. Hệ thống quản lý điểm sinh viên",
    ),
    criteria: [
      {
        id: "arr_b5_methods",
        type: "js_analysis",
        label: "Sử dụng filter() và map() để lọc và biến đổi mảng điểm",
        selector: "js",
        property: "uses_array_methods",
        expected: "filter,map",
        weight: 25,
      },
      {
        id: "arr_b5_vars",
        type: "js_analysis",
        label: "Lưu kết quả vào các biến và mảng tương ứng (>= 4 biến/mảng)",
        selector: "js",
        property: "min_variables",
        expected: ">= 4 biến",
        minCount: 4,
        weight: 15,
      },
      {
        id: "arr_b5_stats",
        type: "console_contains",
        label: "In đúng trung bình (6.85), max (10), min (3.5) và số SV đạt (8)",
        selector: "console",
        expected: "6.85&&10&&3.5&&8",
        weight: 25,
      },
      {
        id: "arr_b5_arrays",
        type: "console_contains",
        label: "In đúng danh sách chưa đạt (4, 3.5), mảng tăng +0.5 (9.5, 10.5) và vị trí điểm 8 (1)",
        selector: "console",
        expected: "4&&9.5&&10.5&&1",
        weight: 25,
      },
      {
        id: "arr_b5_scope",
        type: "js_analysis",
        label: "Thực thi logic thuần JavaScript trên Console",
        selector: "js",
        property: "no_dom",
        expected: "Không dùng DOM",
        weight: 10,
      },
    ],
  },
  // ─── 08. ĐỐI TƯỢNG (OBJECT) ────────────────────────────────────────────
  {
    id: "js-obj-01",
    label: "Bài 01. Thông tin cá nhân (Object · Dễ · 100 điểm)",
    category: "JavaScript – Đối tượng (Object)",
    difficulty: "Dễ",
    title: "Bài 01. Thông tin cá nhân (Object)",
    description:
      "Tạo một Object sinhVien lưu trữ thông tin cá nhân:\n" +
      "- Họ tên: Trần Minh Tuấn | Tuổi: 21 | Giới tính: Nam | Trường học: HUTECH | Ngành học: Công nghệ thông tin.\n\n" +
      "Tiêu chí:\n" +
      "1. Khai báo Object chứa đầy đủ thuộc tính.\n" +
      "2. Truy cập và in từng thuộc tính.\n" +
      "3. Thay đổi tuổi thành 22.\n" +
      "4. Thêm thuộc tính email.\n" +
      "5. Xóa thuộc tính giới tính.\n" +
      "6. In Object sau khi cập nhật." +
      COMMON_FN_ARR_OBJ_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 01 (Object): Khai báo Object sinhVien, cập nhật tuổi 22, thêm email, xóa giới tính và in ra Console\n`,
      "Bài 01. Thông tin cá nhân (Object)",
    ),
    solutionCode: makeJsConsoleFiles(
      `const sinhVien = {\n  hoTen: "Trần Minh Tuấn",\n  tuoi: 21,\n  gioiTinh: "Nam",\n  truongHoc: "HUTECH",\n  nganhHoc: "Công nghệ thông tin",\n};\n\nconsole.log("Họ tên:", sinhVien.hoTen);\nconsole.log("Tuổi:", sinhVien.tuoi);\nconsole.log("Giới tính:", sinhVien.gioiTinh);\nconsole.log("Trường:", sinhVien.truongHoc);\nconsole.log("Ngành học:", sinhVien.nganhHoc);\n\nsinhVien.tuoi = 22;\nsinhVien.email = "tuan.tm@hutech.edu.vn";\ndelete sinhVien.gioiTinh;\n\nconsole.log("Sau khi cập nhật:", sinhVien);`,
      "Bài 01. Thông tin cá nhân (Object)",
    ),
    criteria: [
      {
        id: "obj_b1_decl",
        type: "js_analysis",
        label: "Khai báo Object và dùng delete để xóa thuộc tính giới tính",
        selector: "js",
        property: "uses_object",
        expected: "delete",
        weight: 30,
      },
      {
        id: "obj_b1_info",
        type: "console_contains",
        label: "In đầy đủ thông tin trước và sau cập nhật (Trần Minh Tuấn, 22, HUTECH, email @)",
        selector: "console",
        expected: "Trần Minh Tuấn&&HUTECH&&Công nghệ thông tin&&22&&@",
        weight: 40,
      },
      {
        id: "obj_b1_lines",
        type: "console_contains",
        label: "In từng thuộc tính và Object sau cập nhật ra Console (>= 4 dòng)",
        selector: "console",
        property: "min_lines",
        expected: "4 dòng",
        minCount: 4,
        weight: 20,
      },
      {
        id: "obj_b1_scope",
        type: "js_analysis",
        label: "Thực thi logic thuần JavaScript trên Console",
        selector: "js",
        property: "no_dom",
        expected: "Không dùng DOM",
        weight: 10,
      },
    ],
  },
  {
    id: "js-obj-02",
    label: "Bài 02. Quản lý sản phẩm (Object · Dễ · 100 điểm)",
    category: "JavaScript – Đối tượng (Object)",
    difficulty: "Dễ",
    title: "Bài 02. Quản lý sản phẩm (Object)",
    description:
      "Tạo Object sanPham với thông tin:\n" +
      "- Tên: Laptop Acer Nitro 5 | Giá: 18.500.000 | Số lượng: 5 | Thương hiệu: Acer | Còn hàng: true.\n\n" +
      "Tiêu chí:\n" +
      "1. Khai báo Object.\n" +
      "2. Truy cập từng thuộc tính bằng dấu chấm (.) và dấu ngoặc vuông ([]).\n" +
      "3. Cập nhật giá sản phẩm và số lượng.\n" +
      "4. Thêm thuộc tính mô tả.\n" +
      "5. Tính tổng giá trị hàng tồn kho bằng giá × số lượng." +
      COMMON_FN_ARR_OBJ_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 02 (Object): Khai báo sanPham, truy cập bằng . và [], cập nhật giá/số lượng, thêm mô tả và tính tồn kho\n`,
      "Bài 02. Quản lý sản phẩm (Object)",
    ),
    solutionCode: makeJsConsoleFiles(
      `const sanPham = {\n  ten: "Laptop Acer Nitro 5",\n  gia: 18500000,\n  soLuong: 5,\n  thuongHieu: "Acer",\n  conHang: true,\n};\n\nconsole.log("Tên (chấm):", sanPham.ten);\nconsole.log("Thương hiệu (ngoặc vuông):", sanPham["thuongHieu"]);\nconsole.log("Còn hàng:", sanPham.conHang);\n\nsanPham.gia = 19000000;\nsanPham["soLuong"] = 4;\nsanPham.moTa = "Laptop gaming màn hình 144Hz";\n\nconst tongTonKho = sanPham.gia * sanPham.soLuong;\nconsole.log("Sản phẩm cập nhật:", sanPham);\nconsole.log("Tổng giá trị tồn kho:", tongTonKho);`,
      "Bài 02. Quản lý sản phẩm (Object)",
    ),
    criteria: [
      {
        id: "obj_b2_decl",
        type: "js_analysis",
        label: "Khai báo Object chứa thông tin sản phẩm",
        selector: "js",
        property: "uses_object",
        expected: "",
        weight: 25,
      },
      {
        id: "obj_b2_ops",
        type: "js_analysis",
        label: "Tính tổng giá trị tồn kho bằng phép nhân (*)",
        selector: "js",
        property: "has_operators",
        expected: "*",
        weight: 15,
      },
      {
        id: "obj_b2_info",
        type: "console_contains",
        label: "In thông tin sản phẩm (Laptop Acer Nitro 5, Acer, true) ra Console",
        selector: "console",
        expected: "Laptop Acer Nitro 5&&Acer&&true",
        weight: 25,
      },
      {
        id: "obj_b2_lines",
        type: "console_contains",
        label: "In đầy đủ kết quả truy cập, cập nhật và tổng tồn kho (>= 4 dòng)",
        selector: "console",
        property: "min_lines",
        expected: "4 dòng",
        minCount: 4,
        weight: 25,
      },
      {
        id: "obj_b2_scope",
        type: "js_analysis",
        label: "Thực thi logic thuần JavaScript trên Console",
        selector: "js",
        property: "no_dom",
        expected: "Không dùng DOM",
        weight: 10,
      },
    ],
  },
  {
    id: "js-obj-03",
    label: "Bài 03. Quản lý tài khoản ngân hàng (Object · Trung bình · 100 điểm)",
    category: "JavaScript – Đối tượng (Object)",
    difficulty: "Trung bình",
    title: "Bài 03. Quản lý tài khoản ngân hàng (Object)",
    description:
      "Tạo Object taiKhoan với thông tin:\n" +
      "- Chủ tài khoản: Nguyễn Văn An | Số tài khoản: 123456789 | Số dư: 10.000.000 | Ngân hàng: Vietcombank.\n\n" +
      "Tạo thêm các phương thức:\n" +
      "- napTien(soTien): Nạp tiền vào tài khoản (không cho nạp <= 0).\n" +
      "- kiemTraSoDu(): Hiển thị số dư hiện tại.\n\n" +
      "Tiêu chí:\n" +
      "1. Khai báo thuộc tính và phương thức, sử dụng từ khóa this.\n" +
      "2. Nạp thêm 2.000.000 VNĐ và in số dư sau khi nạp (12.000.000).\n" +
      "3. Không cho phép nạp số tiền nhỏ hơn hoặc bằng 0." +
      COMMON_FN_ARR_OBJ_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 03 (Object): Tạo Object taiKhoan với phương thức napTien(soTien) và kiemTraSoDu() dùng this\n`,
      "Bài 03. Quản lý tài khoản ngân hàng (Object)",
    ),
    solutionCode: makeJsConsoleFiles(
      `const taiKhoan = {\n  chuTaiKhoan: "Nguyễn Văn An",\n  soTaiKhoan: "123456789",\n  soDu: 10000000,\n  nganHang: "Vietcombank",\n  napTien: function (soTien) {\n    if (soTien <= 0) {\n      console.log("Số tiền nạp phải lớn hơn 0!");\n      return;\n    }\n    this.soDu += soTien;\n    console.log("Nạp thành công:", soTien, "VNĐ");\n  },\n  kiemTraSoDu: function () {\n    console.log("Chủ TK:", this.chuTaiKhoan, "| Ngân hàng:", this.nganHang, "| Số dư hiện tại:", this.soDu);\n  },\n};\n\ntaiKhoan.napTien(-50000);\ntaiKhoan.napTien(2000000);\ntaiKhoan.kiemTraSoDu();`,
      "Bài 03. Quản lý tài khoản ngân hàng (Object)",
    ),
    criteria: [
      {
        id: "obj_b3_obj",
        type: "js_analysis",
        label: "Khai báo Object gồm ít nhất 2 phương thức và sử dụng this",
        selector: "js",
        property: "uses_object",
        expected: "this,methods",
        minCount: 2,
        weight: 30,
      },
      {
        id: "obj_b3_check",
        type: "js_analysis",
        label: "Kiểm tra không cho phép nạp số tiền <= 0 bằng if",
        selector: "js",
        property: "uses_if_else",
        expected: "if",
        weight: 15,
      },
      {
        id: "obj_b3_console",
        type: "console_contains",
        label: "Hiển thị chủ tài khoản (Nguyễn Văn An), Vietcombank và số dư mới (12.000.000)",
        selector: "console",
        property: "regex",
        expected: "Nguyễn Văn An&&Vietcombank&&12[.,]?000[.,]?000",
        weight: 45,
      },
      {
        id: "obj_b3_scope",
        type: "js_analysis",
        label: "Thực thi logic thuần JavaScript trên Console",
        selector: "js",
        property: "no_dom",
        expected: "Không dùng DOM",
        weight: 10,
      },
    ],
  },
  {
    id: "js-obj-04",
    label: "Bài 04. Quản lý thông tin nhân viên (Object · Trung bình · 100 điểm)",
    category: "JavaScript – Đối tượng (Object)",
    difficulty: "Trung bình",
    title: "Bài 04. Quản lý thông tin nhân viên (Object)",
    description:
      "Tạo Object nhanVien gồm: Mã NV NV001, Họ tên Nguyễn Thị Mai, Lương cơ bản 8.000.000, Số ngày công 26, Tiền thưởng 1.000.000.\n\n" +
      "Tạo các phương thức:\n" +
      "- tinhLuong(): Tính lương cơ bản cộng tiền thưởng.\n" +
      "- hienThiThongTin(): Hiển thị thông tin nhân viên.\n" +
      "- capNhatNgayCong(ngayCong): Cập nhật số ngày công.\n\n" +
      "Tiêu chí:\n" +
      "1. Khai báo đầy đủ thuộc tính và ít nhất 3 phương thức.\n" +
      "2. Sử dụng từ khóa this.\n" +
      "3. Cập nhật số ngày công thành 24, tính và hiển thị tổng lương." +
      COMMON_FN_ARR_OBJ_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 04 (Object): Tạo Object nhanVien với 3 phương thức dùng this, cập nhật ngày công 24 và hiển thị lương\n`,
      "Bài 04. Quản lý thông tin nhân viên (Object)",
    ),
    solutionCode: makeJsConsoleFiles(
      `const nhanVien = {\n  maNV: "NV001",\n  hoTen: "Nguyễn Thị Mai",\n  luongCoBan: 8000000,\n  soNgayCong: 26,\n  tienThuong: 1000000,\n  tinhLuong: function () {\n    return this.luongCoBan + this.tienThuong;\n  },\n  capNhatNgayCong: function (ngayCong) {\n    this.soNgayCong = ngayCong;\n  },\n  hienThiThongTin: function () {\n    console.log("Mã NV:", this.maNV, "| Họ tên:", this.hoTen, "| Ngày công:", this.soNgayCong, "| Tổng lương:", this.tinhLuong());\n  },\n};\n\nnhanVien.capNhatNgayCong(24);\nnhanVien.hienThiThongTin();`,
      "Bài 04. Quản lý thông tin nhân viên (Object)",
    ),
    criteria: [
      {
        id: "obj_b4_obj",
        type: "js_analysis",
        label: "Khai báo Object có ít nhất 3 phương thức và sử dụng this",
        selector: "js",
        property: "uses_object",
        expected: "this,methods",
        minCount: 3,
        weight: 35,
      },
      {
        id: "obj_b4_info",
        type: "console_contains",
        label: "Hiển thị mã NV (NV001), họ tên (Nguyễn Thị Mai) và số ngày công mới (24)",
        selector: "console",
        expected: "NV001&&Nguyễn Thị Mai&&24",
        weight: 30,
      },
      {
        id: "obj_b4_salary",
        type: "console_contains",
        label: "Tính và hiển thị đúng tổng lương ra Console (9.000.000)",
        selector: "console",
        property: "regex",
        expected: "(?:9[.,]?000[.,]?000|8[.,]?384)",
        weight: 25,
      },
      {
        id: "obj_b4_scope",
        type: "js_analysis",
        label: "Thực thi logic thuần JavaScript trên Console",
        selector: "js",
        property: "no_dom",
        expected: "Không dùng DOM",
        weight: 10,
      },
    ],
  },
  {
    id: "js-obj-05",
    label: "Bài 05. Hệ thống quản lý giỏ hàng (Khá · 100 điểm)",
    category: "JavaScript – Đối tượng (Object)",
    difficulty: "Khá",
    title: "Bài 05. Hệ thống quản lý giỏ hàng",
    description:
      "Tạo Object gioHang với các thuộc tính:\n" +
      "- Tên khách hàng: Trần Minh Tuấn | Danh sách sản phẩm: Laptop, Chuột, Bàn phím (mỗi sản phẩm gồm tên và giá) | Tổng tiền: 0.\n\n" +
      "Tạo các phương thức:\n" +
      "1. themSanPham(tenSanPham, gia)\n" +
      "2. xoaSanPham(tenSanPham)\n" +
      "3. tinhTongTien()\n" +
      "4. hienThiGioHang()\n\n" +
      "Tiêu chí:\n" +
      "- Kết hợp Object và Array, sử dụng this, có thể thêm/xóa sản phẩm, tính tổng tiền tự động và hiển thị." +
      COMMON_FN_ARR_OBJ_RULES,
    passThreshold: 100,
    starterCode: makeJsConsoleFiles(
      `// Bài 05 (Object): Kết hợp Object và Array xây dựng gioHang với 4 phương thức dùng this\n`,
      "Bài 05. Hệ thống quản lý giỏ hàng",
    ),
    solutionCode: makeJsConsoleFiles(
      `const gioHang = {\n  tenKhachHang: "Trần Minh Tuấn",\n  danhSachSanPham: [\n    { ten: "Laptop", gia: 15000000 },\n    { ten: "Chuột", gia: 350000 },\n    { ten: "Bàn phím", gia: 850000 },\n  ],\n  tongTien: 0,\n  themSanPham: function (tenSanPham, gia) {\n    this.danhSachSanPham.push({ ten: tenSanPham, gia: gia });\n    this.tinhTongTien();\n  },\n  xoaSanPham: function (tenSanPham) {\n    this.danhSachSanPham = this.danhSachSanPham.filter((sp) => sp.ten !== tenSanPham);\n    this.tinhTongTien();\n  },\n  tinhTongTien: function () {\n    let tong = 0;\n    this.danhSachSanPham.forEach((sp) => {\n      tong += sp.gia;\n    });\n    this.tongTien = tong;\n    return this.tongTien;\n  },\n  hienThiGioHang: function () {\n    this.tinhTongTien();\n    console.log("Khách hàng:", this.tenKhachHang);\n    console.log("Sản phẩm:", this.danhSachSanPham.map((sp) => sp.ten + " (" + sp.gia + ")").join(", "));\n    console.log("Tổng tiền:", this.tongTien);\n  },\n};\n\ngioHang.themSanPham("Tai nghe", 500000);\ngioHang.xoaSanPham("Bàn phím");\ngioHang.hienThiGioHang();`,
      "Bài 05. Hệ thống quản lý giỏ hàng",
    ),
    criteria: [
      {
        id: "obj_b5_obj",
        type: "js_analysis",
        label: "Khai báo Object có đủ 4 phương thức và sử dụng từ khóa this",
        selector: "js",
        property: "uses_object",
        expected: "this,methods",
        minCount: 4,
        weight: 35,
      },
      {
        id: "obj_b5_arr",
        type: "js_analysis",
        label: "Kết hợp mảng sản phẩm (sử dụng phương thức mảng như push/filter/splice/forEach)",
        selector: "js",
        property: "uses_array_methods",
        expected: "push,filter,splice,forEach",
        minCount: 2,
        weight: 15,
      },
      {
        id: "obj_b5_info",
        type: "console_contains",
        label: "Hiển thị tên khách hàng (Trần Minh Tuấn) và danh sách sản phẩm (Laptop, Chuột)",
        selector: "console",
        expected: "Trần Minh Tuấn&&Laptop&&Chuột",
        weight: 25,
      },
      {
        id: "obj_b5_lines",
        type: "console_contains",
        label: "In thông tin giỏ hàng và tổng tiền rõ ràng (>= 3 dòng)",
        selector: "console",
        property: "min_lines",
        expected: "3 dòng",
        minCount: 3,
        weight: 15,
      },
      {
        id: "obj_b5_scope",
        type: "js_analysis",
        label: "Thực thi logic thuần JavaScript trên Console",
        selector: "js",
        property: "no_dom",
        expected: "Không dùng DOM",
        weight: 10,
      },
    ],
  },
  // ─── 09. DOM VÀ SỰ KIỆN (3 FILE: HTML + CSS + JS) ─────────────────────
  {
    id: "js-dom-01",
    label: "Bài 01. Website giới thiệu bản thân (Dễ · 100 điểm)",
    category: "JavaScript – DOM và Sự kiện",
    difficulty: "Dễ",
    title: "Bài 01. Website giới thiệu bản thân",
    description:
      "Xây dựng website giới thiệu thông tin cá nhân gồm đủ 3 file: index.html, style.css, script.js.\n\n" +
      "Thông tin hiển thị:\n" +
      "- Họ tên: Trần Minh Tuấn\n" +
      "- Ngày sinh: 15/08/2005\n" +
      "- Giới tính: Nam\n" +
      "- Ngành học: Công nghệ thông tin\n" +
      "- Trường: HUTECH\n" +
      '- Website có nút "Gửi lời chào"\n\n' +
      "Tiêu chí:\n" +
      '1. Khi nhấn nút "Gửi lời chào", cập nhật giao diện bằng JavaScript để hiển thị thông báo: "Xin chào! Tôi là Trần Minh Tuấn".' +
      COMMON_DOM_RULES,
    passThreshold: 100,
    starterCode: makeWebStarter(
      "Giới thiệu bản thân",
      "Hiển thị thông tin cá nhân (Trần Minh Tuấn, 15/08/2005, Nam, Công nghệ thông tin, HUTECH) và nút Gửi lời chào",
      "Thiết kế giao diện trang giới thiệu bản thân",
      "Lấy phần tử DOM và xử lý sự kiện click nút Gửi lời chào",
    ),
    solutionCode: makeWeb3Files(
      `<!DOCTYPE html>\n<html lang="vi">\n<head>\n  <meta charset="UTF-8">\n  <title>Giới thiệu bản thân</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="profile">\n    <h1>GIỚI THIỆU BẢN THÂN</h1>\n    <h2>Trần Minh Tuấn</h2>\n    <p>Ngày sinh: 15/08/2005</p>\n    <p>Giới tính: Nam</p>\n    <p>Ngành học: Công nghệ thông tin</p>\n    <p>Trường: HUTECH</p>\n    <button id="greetBtn" type="button">Gửi lời chào</button>\n    <p id="greetMsg"></p>\n  </div>\n  <script src="script.js"></script>\n</body>\n</html>`,
      `body {\n  margin: 0;\n  min-height: 100vh;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-family: Arial, sans-serif;\n  background: #e0f2fe;\n}\n.profile {\n  background: #ffffff;\n  padding: 28px;\n  border-radius: 14px;\n  width: 360px;\n  text-align: center;\n  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);\n}\nh1 { color: #1d4ed8; font-size: 20px; }\nbutton {\n  margin-top: 12px;\n  padding: 10px 18px;\n  border: 0;\n  border-radius: 8px;\n  background: #2563eb;\n  color: #fff;\n  font-weight: 700;\n  cursor: pointer;\n}\n#greetMsg { margin-top: 14px; color: #047857; font-weight: 700; }`,
      `const greetBtn = document.getElementById("greetBtn");\nconst greetMsg = document.getElementById("greetMsg");\n\ngreetBtn.addEventListener("click", function () {\n  greetMsg.textContent = "Xin chào! Tôi là Trần Minh Tuấn";\n});`,
    ),
    criteria: [
      { id: "dom_b1_name", type: "text_contains", label: "Hiển thị họ tên: Trần Minh Tuấn", selector: "body", expected: "Trần Minh Tuấn", weight: 15 },
      { id: "dom_b1_dob", type: "text_contains", label: "Hiển thị ngày sinh: 15/08/2005", selector: "body", expected: "15/08/2005", weight: 10 },
      { id: "dom_b1_major", type: "text_contains", label: "Hiển thị ngành học: Công nghệ thông tin", selector: "body", expected: "Công nghệ thông tin", weight: 15 },
      { id: "dom_b1_school", type: "text_contains", label: "Hiển thị trường: HUTECH", selector: "body", expected: "HUTECH", weight: 10 },
      { id: "dom_b1_btn", type: "element_exists", label: 'Có nút "Gửi lời chào" trên giao diện', selector: "button", expected: "Nút button", minCount: 1, weight: 10 },
      {
        id: "dom_b1_click",
        type: "behavior_test",
        label: 'Nhấn nút "Gửi lời chào" hiển thị "Xin chào! Tôi là Trần Minh Tuấn"',
        selector: "button",
        expected: "Xin chào! Tôi là Trần Minh Tuấn",
        steps: [
          { action: "click", target: "button:Gửi lời chào|lời chào|chào" },
          { action: "assert_text", pattern: "Xin chào! Tôi là Trần Minh Tuấn" },
        ],
        weight: 40,
      },
    ],
  },
  {
    id: "js-dom-02",
    label: "Bài 02. Máy tính cộng hai số (Dễ · 100 điểm)",
    category: "JavaScript – DOM và Sự kiện",
    difficulty: "Dễ",
    title: "Bài 02. Máy tính cộng hai số",
    description:
      "Xây dựng website máy tính có hai ô nhập số và một nút \"Tính tổng\" (dùng 3 file index.html, style.css, script.js).\n\n" +
      "Tiêu chí:\n" +
      "1. Lấy giá trị từ hai ô nhập bằng JavaScript và chuyển thành kiểu số.\n" +
      "2. Khi nhấn nút Tính tổng (click), tính tổng hai số và hiển thị kết quả lên giao diện.\n" +
      "3. Thông báo lỗi nếu người dùng chưa nhập đủ dữ liệu." +
      COMMON_DOM_RULES,
    passThreshold: 100,
    starterCode: makeWebStarter(
      "Máy tính cộng hai số",
      "Tạo 2 ô input nhập số, nút Tính tổng và khu vực hiển thị kết quả",
      "Định dạng giao diện máy tính cộng hai số",
      "Bắt sự kiện click, kiểm tra nhập thiếu và tính tổng hai số",
    ),
    solutionCode: makeWeb3Files(
      `<!DOCTYPE html>\n<html lang="vi">\n<head>\n  <meta charset="UTF-8">\n  <title>Máy tính cộng hai số</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="calc-card">\n    <h1>Máy tính cộng hai số</h1>\n    <input id="num1" type="number" placeholder="Nhập số thứ nhất">\n    <input id="num2" type="number" placeholder="Nhập số thứ hai">\n    <button id="sumBtn" type="button">Tính tổng</button>\n    <p id="result">Kết quả sẽ hiển thị tại đây</p>\n  </div>\n  <script src="script.js"></script>\n</body>\n</html>`,
      `body {\n  font-family: Arial, sans-serif;\n  background: #f1f5f9;\n  display: flex;\n  justify-content: center;\n  padding: 40px;\n}\n.calc-card {\n  background: #fff;\n  padding: 24px;\n  border-radius: 12px;\n  width: 340px;\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08);\n}\ninput { padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; }\nbutton { padding: 10px; border: 0; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 700; cursor: pointer; }\n#result { font-weight: 700; color: #0f172a; }`,
      `const num1 = document.getElementById("num1");\nconst num2 = document.getElementById("num2");\nconst sumBtn = document.getElementById("sumBtn");\nconst result = document.getElementById("result");\n\nsumBtn.addEventListener("click", function () {\n  if (num1.value.trim() === "" || num2.value.trim() === "") {\n    result.textContent = "Vui lòng nhập đầy đủ cả hai số!";\n    return;\n  }\n  const tong = Number(num1.value) + Number(num2.value);\n  result.textContent = "Tổng = " + tong;\n});`,
    ),
    criteria: [
      { id: "dom_b2_inputs", type: "element_exists", label: "Có đủ 2 ô nhập liệu số trên giao diện", selector: "input", expected: ">= 2 ô input", minCount: 2, weight: 15 },
      { id: "dom_b2_btn", type: "element_exists", label: 'Có nút "Tính tổng"', selector: "button", expected: "Nút Tính tổng", minCount: 1, weight: 10 },
      {
        id: "dom_b2_empty",
        type: "behavior_test",
        label: "Thông báo nhắc nhở khi chưa nhập đủ hai số",
        selector: "button",
        expected: "Thông báo nhập thiếu",
        steps: [
          { action: "click", target: "button:Tính tổng|tính|cộng" },
          { action: "assert_text", pattern: "(?:nhập|đầy đủ|trống|lỗi|hợp lệ)", regex: true },
        ],
        weight: 25,
      },
      {
        id: "dom_b2_add1",
        type: "behavior_test",
        label: "Nhập 15 và 25 rồi bấm Tính tổng hiển thị đúng 40",
        selector: "button",
        expected: "40",
        steps: [
          { action: "set_value", target: "input:#0", value: "15" },
          { action: "set_value", target: "input:#1", value: "25" },
          { action: "click", target: "button:Tính tổng|tính|cộng" },
          { action: "assert_text", pattern: "40" },
        ],
        weight: 30,
      },
      {
        id: "dom_b2_add2",
        type: "behavior_test",
        label: "Chuyển đổi số thực chính xác (12.5 + 7.5 = 20)",
        selector: "button",
        expected: "20",
        steps: [
          { action: "set_value", target: "input:#0", value: "12.5" },
          { action: "set_value", target: "input:#1", value: "7.5" },
          { action: "click", target: "button:Tính tổng|tính|cộng" },
          { action: "assert_text", pattern: "20" },
        ],
        weight: 20,
      },
    ],
  },
  {
    id: "js-dom-03",
    label: "Bài 03. Ứng dụng đổi màu nền (Trung bình · 100 điểm)",
    category: "JavaScript – DOM và Sự kiện",
    difficulty: "Trung bình",
    title: "Bài 03. Ứng dụng đổi màu nền",
    description:
      "Xây dựng website cho phép người dùng thay đổi màu nền trang web (3 file: index.html, style.css, script.js).\n\n" +
      "Giao diện gồm 5 nút: Màu đỏ, Màu xanh, Màu vàng, Màu tím, Khôi phục màu mặc định.\n\n" +
      "Tiêu chí:\n" +
      "- Sử dụng addEventListener() đổi màu nền thực tế của trang và hiển thị tên màu đang được chọn." +
      COMMON_DOM_RULES,
    passThreshold: 100,
    starterCode: makeWebStarter(
      "Ứng dụng đổi màu nền",
      "Tạo 5 nút (Màu đỏ, Màu xanh, Màu vàng, Màu tím, Khôi phục màu mặc định) và thẻ hiển thị màu đang chọn",
      "Thiết kế nút bấm đổi màu nền",
      "Gắn addEventListener click cho 5 nút để đổi màu nền body và hiển thị tên màu",
    ),
    solutionCode: makeWeb3Files(
      `<!DOCTYPE html>\n<html lang="vi">\n<head>\n  <meta charset="UTF-8">\n  <title>Ứng dụng đổi màu nền</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="panel">\n    <h1>Ứng dụng đổi màu nền</h1>\n    <div class="btn-group">\n      <button id="btnRed" type="button">Màu đỏ</button>\n      <button id="btnBlue" type="button">Màu xanh</button>\n      <button id="btnYellow" type="button">Màu vàng</button>\n      <button id="btnPurple" type="button">Màu tím</button>\n      <button id="btnReset" type="button">Khôi phục màu mặc định</button>\n    </div>\n    <p id="colorLabel">Màu đang chọn: Mặc định</p>\n  </div>\n  <script src="script.js"></script>\n</body>\n</html>`,
      `body {\n  font-family: Arial, sans-serif;\n  min-height: 100vh;\n  margin: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  transition: background-color 0.25s;\n}\n.panel {\n  background: rgba(255, 255, 255, 0.92);\n  padding: 24px;\n  border-radius: 14px;\n  text-align: center;\n  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);\n}\n.btn-group { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 14px 0; }\nbutton { padding: 9px 14px; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer; font-weight: 700; }`,
      `const label = document.getElementById("colorLabel");\n\ndocument.getElementById("btnRed").addEventListener("click", function () {\n  document.body.style.backgroundColor = "#ef4444";\n  label.textContent = "Màu đang chọn: Màu đỏ";\n});\ndocument.getElementById("btnBlue").addEventListener("click", function () {\n  document.body.style.backgroundColor = "#3b82f6";\n  label.textContent = "Màu đang chọn: Màu xanh";\n});\ndocument.getElementById("btnYellow").addEventListener("click", function () {\n  document.body.style.backgroundColor = "#facc15";\n  label.textContent = "Màu đang chọn: Màu vàng";\n});\ndocument.getElementById("btnPurple").addEventListener("click", function () {\n  document.body.style.backgroundColor = "#a855f7";\n  label.textContent = "Màu đang chọn: Màu tím";\n});\ndocument.getElementById("btnReset").addEventListener("click", function () {\n  document.body.style.backgroundColor = "";\n  label.textContent = "Màu đang chọn: Mặc định";\n});`,
    ),
    criteria: [
      { id: "dom_b3_btns", type: "element_exists", label: "Có đủ 5 nút lựa chọn màu trên giao diện", selector: "button", expected: ">= 5 nút", minCount: 5, weight: 15 },
      {
        id: "dom_b3_red",
        type: "behavior_test",
        label: 'Nhấn "Màu đỏ" đổi nền trang sang đỏ và hiển thị tên màu',
        selector: "body",
        expected: "Màu đỏ",
        steps: [
          { action: "click", target: "button:Màu đỏ|đỏ" },
          { action: "assert_style", selector: "body", check: "bg", expected: "family:red" },
          { action: "assert_text", pattern: "(?:đỏ|red)", regex: true },
        ],
        weight: 20,
      },
      {
        id: "dom_b3_blue",
        type: "behavior_test",
        label: 'Nhấn "Màu xanh" đổi nền trang sang xanh và hiển thị tên màu',
        selector: "body",
        expected: "Màu xanh",
        steps: [
          { action: "click", target: "button:Màu xanh|xanh" },
          { action: "assert_style", selector: "body", check: "bg", expected: "family:blue|family:light-blue|family:green" },
          { action: "assert_text", pattern: "(?:xanh|blue|green)", regex: true },
        ],
        weight: 15,
      },
      {
        id: "dom_b3_yellow",
        type: "behavior_test",
        label: 'Nhấn "Màu vàng" đổi nền trang sang vàng và hiển thị tên màu',
        selector: "body",
        expected: "Màu vàng",
        steps: [
          { action: "click", target: "button:Màu vàng|vàng" },
          { action: "assert_style", selector: "body", check: "bg", expected: "family:yellow" },
          { action: "assert_text", pattern: "(?:vàng|yellow)", regex: true },
        ],
        weight: 15,
      },
      {
        id: "dom_b3_purple",
        type: "behavior_test",
        label: 'Nhấn "Màu tím" đổi nền trang sang tím và hiển thị tên màu',
        selector: "body",
        expected: "Màu tím",
        steps: [
          { action: "click", target: "button:Màu tím|tím" },
          { action: "assert_style", selector: "body", check: "bg", expected: "family:purple|family:light-purple" },
          { action: "assert_text", pattern: "(?:tím|purple)", regex: true },
        ],
        weight: 15,
      },
      {
        id: "dom_b3_reset",
        type: "behavior_test",
        label: 'Nhấn "Khôi phục màu mặc định" đưa màu nền về mặc định',
        selector: "body",
        expected: "Mặc định",
        steps: [
          { action: "click", target: "button:Màu đỏ|đỏ" },
          { action: "click", target: "button:Khôi phục|mặc định|reset" },
          { action: "assert_style", selector: "body", check: "bg", expected: "family:default" },
        ],
        weight: 20,
      },
    ],
  },
  {
    id: "js-dom-04",
    label: "Bài 04. Quản lý danh sách công việc (Trung bình · 100 điểm)",
    category: "JavaScript – DOM và Sự kiện",
    difficulty: "Trung bình",
    title: "Bài 04. Quản lý danh sách công việc",
    description:
      "Xây dựng ứng dụng Todo List đơn giản (3 file: index.html, style.css, script.js).\n\n" +
      "Giao diện gồm:\n" +
      '- Ô nhập tên công việc, nút "Thêm công việc", danh sách công việc, nút xóa từng công việc.\n\n' +
      "Tiêu chí:\n" +
      "1. Thêm công việc mới lên giao diện khi bấm nút.\n" +
      "2. Không cho phép thêm công việc rỗng.\n" +
      "3. Cho phép xóa từng công việc riêng lẻ." +
      COMMON_DOM_RULES,
    passThreshold: 100,
    starterCode: makeWebStarter(
      "Quản lý danh sách công việc",
      "Tạo ô nhập công việc, nút Thêm công việc và danh sách ul/div để hiển thị & xóa từng công việc",
      "Thiết kế giao diện Todo List",
      "Xử lý thêm công việc (chặn chuỗi rỗng) và nút xóa từng công việc",
    ),
    solutionCode: makeWeb3Files(
      `<!DOCTYPE html>\n<html lang="vi">\n<head>\n  <meta charset="UTF-8">\n  <title>Todo List</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="todo-app">\n    <h1>Danh sách công việc</h1>\n    <div class="input-row">\n      <input id="todoInput" type="text" placeholder="Nhập tên công việc...">\n      <button id="addBtn" type="button">Thêm công việc</button>\n    </div>\n    <p id="todoError"></p>\n    <ul id="todoList"></ul>\n  </div>\n  <script src="script.js"></script>\n</body>\n</html>`,
      `body { font-family: Arial, sans-serif; background: #f8fafc; display: flex; justify-content: center; padding: 36px; }\n.todo-app { width: 420px; background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); }\n.input-row { display: flex; gap: 8px; }\ninput { flex: 1; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; }\nbutton { padding: 9px 14px; border: 0; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 700; cursor: pointer; }\nul { list-style: none; padding: 0; margin: 16px 0 0; display: flex; flex-direction: column; gap: 8px; }\nli { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #f1f5f9; border-radius: 8px; }\n.del-btn { background: #ef4444; padding: 5px 10px; font-size: 12px; }\n#todoError { color: #dc2626; font-size: 13px; margin: 8px 0 0; }`,
      `const input = document.getElementById("todoInput");\nconst addBtn = document.getElementById("addBtn");\nconst list = document.getElementById("todoList");\nconst err = document.getElementById("todoError");\n\naddBtn.addEventListener("click", function () {\n  const text = input.value.trim();\n  if (!text) {\n    err.textContent = "Vui lòng nhập tên công việc!";\n    return;\n  }\n  err.textContent = "";\n  const li = document.createElement("li");\n  li.innerHTML = '<span>' + text + '</span><button type="button" class="del-btn">Xóa</button>';\n  li.querySelector(".del-btn").addEventListener("click", function () {\n    li.remove();\n  });\n  list.appendChild(li);\n  input.value = "";\n});`,
    ),
    criteria: [
      { id: "dom_b4_input", type: "element_exists", label: "Có ô nhập tên công việc", selector: "input", expected: "Ô input", minCount: 1, weight: 10 },
      { id: "dom_b4_btn", type: "element_exists", label: 'Có nút "Thêm công việc"', selector: "button", expected: "Nút Thêm công việc", minCount: 1, weight: 10 },
      {
        id: "dom_b4_empty",
        type: "behavior_test",
        label: "Không cho phép thêm công việc rỗng vào danh sách",
        selector: "ul, li",
        expected: "0 công việc khi rỗng",
        steps: [
          { action: "set_value", target: "input:#0", value: "   " },
          { action: "click", target: "button:Thêm công việc|thêm" },
          { action: "assert_count", selector: "li, .todo-item, .task-item", max: 0 },
        ],
        weight: 20,
      },
      {
        id: "dom_b4_add",
        type: "behavior_test",
        label: "Thêm công việc mới và hiển thị đầy đủ trên giao diện",
        selector: "li",
        expected: "Hiển thị các công việc đã thêm",
        steps: [
          { action: "set_value", target: "input:#0", value: "Học JavaScript" },
          { action: "click", target: "button:Thêm công việc|thêm" },
          { action: "set_value", target: "input:#0", value: "Làm bài tập DOM" },
          { action: "click", target: "button:Thêm công việc|thêm" },
          { action: "assert_text", pattern: "Học JavaScript" },
          { action: "assert_text", pattern: "Làm bài tập DOM" },
        ],
        weight: 30,
      },
      {
        id: "dom_b4_delete",
        type: "behavior_test",
        label: "Cho phép xóa đúng công việc khi bấm nút Xóa",
        selector: "li",
        expected: "Xóa được dòng công việc",
        steps: [
          { action: "set_value", target: "input:#0", value: "Dọn bàn học" },
          { action: "click", target: "button:Thêm công việc|thêm" },
          { action: "assert_text", pattern: "Dọn bàn học" },
          { action: "click", target: "row-button:Dọn bàn học|xóa|delete|x" },
          { action: "assert_text", pattern: "Dọn bàn học", absent: true },
        ],
        weight: 30,
      },
    ],
  },
  {
    id: "js-dom-05",
    label: "Bài 05. Hệ thống đăng ký khóa học (Khá · 100 điểm)",
    category: "JavaScript – DOM và Sự kiện",
    difficulty: "Khá",
    title: "Bài 05. Hệ thống đăng ký khóa học",
    description:
      "Xây dựng website đăng ký khóa học trực tuyến (3 file: index.html, style.css, script.js).\n\n" +
      "Giao diện gồm: Họ và tên, Email, Số điện thoại, Chọn khóa học (JavaScript cơ bản: 1.500.000 VNĐ; Python cơ bản: 2.000.000 VNĐ; Cơ sở dữ liệu: 1.200.000 VNĐ), Hình thức học (Online / Offline), nút Đăng ký.\n\n" +
      "Tiêu chí:\n" +
      "1. Sử dụng sự kiện submit và ngăn trang tải lại (preventDefault).\n" +
      "2. Kiểm tra trường bắt buộc không rỗng và định dạng email hợp lệ.\n" +
      "3. Hiển thị thông tin đăng ký, tên khóa học và học phí tương ứng lên giao diện." +
      COMMON_DOM_RULES,
    passThreshold: 100,
    starterCode: makeWebStarter(
      "Đăng ký khóa học trực tuyến",
      "Tạo form gồm Họ tên, Email, SĐT, Chọn khóa học, Hình thức học (Online/Offline), nút Đăng ký và vùng kết quả",
      "Thiết kế biểu mẫu đăng ký khóa học",
      "Bắt sự kiện submit, chặn reload bằng preventDefault(), validate và hiển thị học phí tương ứng",
    ),
    solutionCode: makeWeb3Files(
      `<!DOCTYPE html>\n<html lang="vi">\n<head>\n  <meta charset="UTF-8">\n  <title>Đăng ký khóa học</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="form-wrap">\n    <h1>Đăng ký khóa học trực tuyến</h1>\n    <form id="regForm" novalidate>\n      <label>Họ và tên <input id="fullName" type="text" placeholder="Nhập họ và tên"></label>\n      <label>Email <input id="email" type="email" placeholder="Nhập email"></label>\n      <label>Số điện thoại <input id="phone" type="tel" placeholder="Nhập số điện thoại"></label>\n      <label>Khóa học\n        <select id="course">\n          <option value="JavaScript cơ bản">JavaScript cơ bản - 1.500.000 VNĐ</option>\n          <option value="Python cơ bản">Python cơ bản - 2.000.000 VNĐ</option>\n          <option value="Cơ sở dữ liệu">Cơ sở dữ liệu - 1.200.000 VNĐ</option>\n        </select>\n      </label>\n      <label>Hình thức học\n        <select id="mode">\n          <option value="Online">Online</option>\n          <option value="Offline">Offline</option>\n        </select>\n      </label>\n      <button type="submit">Đăng ký</button>\n    </form>\n    <div id="output"></div>\n  </div>\n  <script src="script.js"></script>\n</body>\n</html>`,
      `body { font-family: Arial, sans-serif; background: #eff6ff; display: flex; justify-content: center; padding: 30px; }\n.form-wrap { width: 420px; background: #fff; padding: 24px; border-radius: 14px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); }\nform { display: flex; flex-direction: column; gap: 12px; }\nlabel { display: flex; flex-direction: column; gap: 5px; font-weight: 700; font-size: 13px; color: #334155; }\ninput, select { padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 400; }\nbutton { padding: 11px; border: 0; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 700; cursor: pointer; }\n#output { margin-top: 16px; padding: 12px; border-radius: 8px; background: #f8fafc; font-size: 14px; }`,
      `const form = document.getElementById("regForm");\nconst output = document.getElementById("output");\n\nconst hocPhiTheoKhoa = {\n  "JavaScript cơ bản": "1.500.000 VNĐ",\n  "Python cơ bản": "2.000.000 VNĐ",\n  "Cơ sở dữ liệu": "1.200.000 VNĐ",\n};\n\nform.addEventListener("submit", function (e) {\n  e.preventDefault();\n  const name = document.getElementById("fullName").value.trim();\n  const email = document.getElementById("email").value.trim();\n  const phone = document.getElementById("phone").value.trim();\n  const course = document.getElementById("course").value;\n  const mode = document.getElementById("mode").value;\n\n  if (!name || !email || !phone) {\n    output.innerHTML = '<p style="color:#dc2626">Vui lòng nhập đầy đủ các trường bắt buộc!</p>';\n    return;\n  }\n  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {\n    output.innerHTML = '<p style="color:#dc2626">Định dạng email không hợp lệ!</p>';\n    return;\n  }\n  const fee = hocPhiTheoKhoa[course] || "";\n  output.innerHTML =\n    "<strong>Đăng ký thành công!</strong><br>" +\n    "Học viên: " + name + "<br>" +\n    "Email: " + email + " | SĐT: " + phone + "<br>" +\n    "Khóa học: " + course + "<br>" +\n    "Hình thức: " + mode + "<br>" +\n    "Học phí: " + fee;\n});`,
    ),
    criteria: [
      { id: "dom_b5_fields", type: "element_exists", label: "Có đầy đủ các trường nhập thông tin và lựa chọn khóa học", selector: "input, select", expected: ">= 4 trường", minCount: 4, weight: 15 },
      {
        id: "dom_b5_empty",
        type: "behavior_test",
        label: "Kiểm tra không cho bỏ trống các trường bắt buộc khi gửi biểu mẫu",
        selector: "form",
        expected: "Cảnh báo thiếu thông tin",
        steps: [
          { action: "click", target: "button:Đăng ký|gửi|submit" },
          { action: "assert_text", pattern: "(?:vui lòng|bắt buộc|đầy đủ|trống|nhập)", regex: true },
        ],
        weight: 20,
      },
      {
        id: "dom_b5_email",
        type: "behavior_test",
        label: "Kiểm tra định dạng email không hợp lệ",
        selector: "form",
        expected: "Cảnh báo email không hợp lệ",
        steps: [
          { action: "set_value", target: "input:họ|tên|#0", value: "Nguyễn Văn An" },
          { action: "set_value", target: "input:email|#1", value: "email-khong-hop-le" },
          { action: "set_value", target: "input:điện thoại|sdt|phone|#2", value: "0901234567" },
          { action: "click", target: "button:Đăng ký|gửi|submit" },
          { action: "assert_text", pattern: "(?:email|hợp lệ)", regex: true },
        ],
        weight: 20,
      },
      {
        id: "dom_b5_valid",
        type: "behavior_test",
        label: "Đăng ký hợp lệ: không reload trang, hiển thị thông tin, khóa học (Python cơ bản) và học phí (2.000.000 VNĐ)",
        selector: "form",
        expected: "Trần Minh Tuấn, Python cơ bản, 2.000.000 VNĐ, Online",
        steps: [
          { action: "set_value", target: "input:họ|tên|#0", value: "Trần Minh Tuấn" },
          { action: "set_value", target: "input:email|#1", value: "tuan@example.com" },
          { action: "set_value", target: "input:điện thoại|sdt|phone|#2", value: "0912345678" },
          { action: "select_option", target: "select:khóa học|#0", optionText: "Python cơ bản" },
          { action: "select_option", target: "select:hình thức|#1", optionText: "Online" },
          { action: "click", target: "button:Đăng ký|gửi|submit" },
          { action: "assert_text", pattern: "Trần Minh Tuấn" },
          { action: "assert_text", pattern: "Python cơ bản" },
          { action: "assert_text", pattern: "2[.,]?000[.,]?000", regex: true },
          { action: "assert_text", pattern: "Online" },
        ],
        weight: 45,
      },
    ],
  },
];
