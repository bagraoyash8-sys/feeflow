# FeeFlow — Smart Fees. Simple Management. 🎓💳

> A modern, full-stack college fee collection, receipt generation, and accounting management portal built with **Node.js, Express.js, MySQL, HTML5, CSS3, and Vanilla JavaScript**.

---

## 🌟 Key Features

- **🛡️ Dual Role Access (RBAC)**: Secure JWT-authenticated portals for College Administrators and Students.
- **📊 Interactive Admin Dashboard**: Real-time KPI summaries, dynamic collection graphs (Chart.js), and transaction feeds.
- **👥 Student Records Management**: Search, filter, add, edit, and deactivate student profiles across programs and academic years.
- **💰 Flexible Fee Structures**: Head-wise breakdowns (Tuition, Admission, Examination, Library, Lab, Sports, Scholarships, Discounts).
- **🧾 Instant Receipt Engine**: Printable and PDF-exportable official college receipts with unique receipt numbering.
- **📱 Responsive & Cross-Device**: Accessible on desktop, tablets, and smartphones without app installation.
- **⚡ Zero-Framework Frontend**: Lightning-fast vanilla JS client using CSS custom properties and Google Fonts.
- **☁️ Cloud & Render Ready**: Includes `render.yaml`, automatic database connection fallbacks, and SSL support for free cloud databases.

---

## 🗂️ Project Directory Structure

```text
feeflow/
├── backend/
│   ├── config/             # MySQL2 promise connection pool & SSL config
│   ├── controllers/        # auth, admin, student, settings controllers
│   ├── database/           # schema.sql and seed.js with mock data
│   ├── middleware/         # JWT verification & role authorization
│   ├── routes/             # RESTful API endpoints
│   ├── .env.example        # Environment variables template
│   └── server.js           # Express app & static asset server
├── frontend/
│   ├── css/style.css       # Complete UI design system & print styles
│   ├── js/                 # API client, auth guards, toasts, formatters
│   ├── pages/admin/        # 16 Admin management pages
│   ├── pages/student/      # 5 Student portal pages
│   ├── index.html          # Public landing page
│   ├── about.html          # About FeeFlow
│   ├── features.html       # Features breakdown
│   ├── contact.html        # Contact inquiry form
│   └── login.html          # Dual tabbed Admin / Student login
├── package.json            # Root deployment & build orchestrator
├── render.yaml             # Render Blueprint specification
└── README.md               # Documentation
```

---

## 🚀 Quick Local Setup

1. **Clone or navigate to the directory**:
   ```bash
   cd feeflow
   ```

2. **Install dependencies**:
   ```bash
   npm run build
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `backend/.env` and update your MySQL credentials:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=feeflow
   DB_PORT=3306
   JWT_SECRET=your_jwt_secret_key
   ```

4. **Initialize Database & Seed Data**:
   Ensure MySQL (e.g. XAMPP) is running, then execute:
   ```bash
   npm run seed
   ```

5. **Start the Application**:
   ```bash
   npm start
   ```
   Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## 🌐 Deploying to GitHub & Render (Access From Any Device)

Deploying FeeFlow allows students and administrators to open the website directly on any mobile phone, tablet, or PC worldwide.

### Step 1: Push Code to GitHub

1. Open PowerShell or Terminal inside the `feeflow` folder:
   ```powershell
   git init
   git add .
   git commit -m "Initial commit of FeeFlow"
   ```

2. Authenticate and create a public repository using GitHub CLI (`gh`):
   ```powershell
   gh auth login
   gh repo create feeflow --public --source=. --remote=origin --push
   ```
   *Or manually create a repository named `feeflow` on [github.com/new](https://github.com/new), and run:*
   ```powershell
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/feeflow.git
   git branch -M main
   git push -u origin main
   ```

---

### Step 2: Set Up a Free Cloud MySQL Database

Render's web servers are stateless, so for your data to persist and be accessible from any device, use a free cloud MySQL provider:

#### Option A: TiDB Serverless (Recommended — 100% Free Forever, 5GB)
1. Go to [tidbcloud.com](https://tidbcloud.com) and sign up with your Google/GitHub account.
2. Click **Create Cluster** and select **TiDB Serverless** (Free).
3. Name your cluster (e.g. `feeflow-db`) and click **Create**.
4. Click **Connect** and select **Node.js** or copy the connection string.
5. You will get:
   - **Host**: e.g., `gateway01.us-east-1.prod.aws.tidbcloud.com`
   - **Port**: `4000`
   - **User**: e.g., `xxxx.root`
   - **Password**: your generated password
   - **Database**: `test` or `feeflow`

#### Option B: Clever Cloud (Free 5MB MySQL add-on)
1. Sign up at [clever-cloud.com](https://www.clever-cloud.com).
2. Create an **Add-on** -> **MySQL** (Free personal plan).
3. Copy `Host`, `Database`, `User`, `Password`, and `Port` from the dashboard.

#### Seed Cloud Database with Initial Data:
In your local `backend/.env`, temporarily paste the cloud DB credentials and run:
```powershell
npm run seed
```
This populates the cloud database with initial courses, departments, fee structures, demo students, and admin login!

---

### Step 3: Deploy to Render

1. Sign up / Log in to [render.com](https://render.com) using your GitHub account.
2. Click **New +** and select **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your `feeflow` repository.
4. Fill in the deployment details:
   - **Name**: `feeflow` (or `feeflow-portal`)
   - **Region**: Choose the closest region (e.g., Oregon, Singapore, Frankfurt)
   - **Runtime**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Expand **Environment Variables** and add:
   - `JWT_SECRET` = `any_long_random_secret_string`
   - `DB_HOST` = `<your_cloud_db_host>`
   - `DB_PORT` = `<your_cloud_db_port>` (e.g., `4000` for TiDB or `3306`)
   - `DB_USER` = `<your_cloud_db_user>`
   - `DB_PASSWORD` = `<your_cloud_db_password>`
   - `DB_NAME` = `<your_cloud_db_name>`
   - `DB_SSL` = `true`
   *(Or alternatively, just add `DATABASE_URL` with your full MySQL connection string!)*
6. Click **Deploy Web Service**!

Render will build and deploy FeeFlow. Within 2-3 minutes, you will get a permanent live public URL such as:
**`https://feeflow.onrender.com`**

Share this URL with anyone — it works seamlessly across phones, laptops, and tablets!

---

## 🔑 Demo Login Credentials

| Role | Username / Identifier | Password | Account Details |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@feeflow.edu` | `admin123` | Full Administrative Privileges & Financial Controls |
| **Student (Paid)** | `CS2024001` | `student123` | Yash Bagrao (B.Tech CSE - All Fees Cleared) |
| **Student (Partial)** | `CS2024002` | `student123` | Rahul Sharma (B.Tech CSE - ₹35,000 Pending) |
| **Student (Scholarship)** | `IT2024001` | `student123` | Priya Patil (B.Tech IT - ₹20,000 Merit Concession) |
| **Student (Defaulter)** | `EXTC2024001` | `student123` | Aditya More (EXTC - Full ₹80,000 Pending) |
| **Student (Overdue)** | `BCA2024001` | `student123` | Sneha Joshi (BCA - Overdue Installment) |

---

## 📄 License
This project is open-source and available under the [ISC License](LICENSE).
