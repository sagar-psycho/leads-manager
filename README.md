# 🚚 ABRA Logistics CRM

> **Enterprise Lead Management & Sales Automation Platform**
>
> A modern, AI-powered CRM built for ABRA Logistics to streamline lead management, automate assignment, improve sales productivity, and manage driver recruitment through an integrated HR workflow.

---

## 📌 Overview

ABRA Logistics CRM is a comprehensive internal Customer Relationship Management (CRM) system designed to manage logistics inquiries, freight campaigns, driver recruitment, sales operations, reporting, and workflow automation.

The system uses **Firebase** as its backend, follows a **role-based access control** architecture, and supports **dynamic campaign-to-role assignment**, ensuring scalable and maintainable business operations.

---

# ✨ Key Features

## 👥 Role Based Access

- 🔑 Super Admin
- 🛠 Admin
- 💼 Sales Member
- 👨‍💼 HR

Each role has dedicated permissions and dashboards.

---

## 📞 Lead Management

- Add/Edit/Delete Leads
- Search & Filter
- Campaign-wise Leads
- Assignment History
- Timeline Tracking
- Notes
- Status Management
- Follow-up Scheduling
- Pagination
- Real-time Firebase Sync

---

## ⚡ Intelligent Assignment Engine

The CRM contains a centralized assignment engine.

Supports:

- Round Robin Assignment
- Office Hours
- Working Days
- Holidays
- Lunch Break
- Leave Management
- Pending Assignment
- Auto Assignment
- Assignment History
- Dynamic Campaign Routing

No duplicate assignment logic.

---

# 🎯 Dynamic Campaign Assignment

Every campaign has its own

```
Assignment Role
```

Example

| Campaign | Assignment Role |
|-----------|-----------------|
| Freight Services | Sales Member |
| Driver Recruitment | HR |

The assignment engine automatically determines which department receives a lead.

No hardcoded campaign logic.

---

# 👨‍💼 HR Recruitment Workflow

Driver Recruitment campaigns are handled directly by HR.

Existing logistics leads can be transferred from Sales to HR through an approval workflow.

Workflow

```
Sales Lead
      ↓
Status = Driver
      ↓
Transfer Request
      ↓
Admin Approval
      ↓
Assigned to HR
```

Sales still has read-only access after transfer.

---

# 📋 HR Transfer Approval

Only

- Super Admin
- Admin

can approve HR transfers.

Every transfer stores

- Requested By
- Requested Date
- Approved By
- Approved Date
- Assignment History

Complete audit trail maintained.

---

# 📈 Dashboard

Real-time KPI cards

- Total Leads
- Interested
- Busy
- Not Interested
- Drivers
- Transporters
- Job Seekers
- Pending
- Follow Ups

Role-specific dashboards.

---

# 📊 Reports

- Daily Report
- Campaign Reports
- WhatsApp Share
- Copy Report
- Date Filters
- Manager Reports

Role-aware reporting.

---

# ☎ Call Audit

Mandatory only for Sales.

Sales

```
Not Interested
```

↓

Recording Required

HR

```
Not Interested
```

↓

Recording Optional

---

# 🗓 Leave Management

Supports

- Full Day Leave
- Half Day Leave
- Emergency Leave

Assignment engine automatically skips unavailable users.

---

# 🏢 Campaign Management

Create unlimited campaigns.

Each campaign contains

- Name
- Status
- Custom Fields
- Assignment Role

Campaign routing is fully configurable.

---

# 🎓 Sales Academy

Integrated learning system

- Training
- Assessments
- Certificates
- Knowledge Base

---

# 🤖 AI Powered

AI features include

- Sales Guidance
- Prompt Generation
- Training Assistance
- Report Assistance

---

# 🔐 Security

Role Based Access Control (RBAC)

Permissions managed through

- Super Admin
- Admin
- Sales
- HR

No unauthorized access.

---

# ⚙ CRM Settings

Manage

- Office Hours
- Holidays
- Working Days
- Reminder Times
- Assignment Settings
- Campaign Routing

---

# 🗄 Technology Stack

## Frontend

- HTML5
- CSS3
- Bootstrap
- Vanilla JavaScript

## Backend

- Firebase Authentication
- Firestore Database

## Cloud

- Firebase Hosting

## APIs

- Firebase SDK
- EmailJS
- WhatsApp Integration

---

# 🏗 Architecture

```
                Firebase
                    │
      ┌─────────────┴─────────────┐
      │                           │
 Authentication              Firestore
      │                           │
      └─────────────┬─────────────┘
                    │
              Business Logic
                    │
    ┌───────────────┼────────────────┐
    │               │                │
 Assignment     Reports         Dashboard
    │               │                │
 Campaigns      Leads         Notifications
```

---

# 📂 Project Structure

```
/
│
├── css/
├── js/
│   ├── app.js
│   ├── assignment.js
│   ├── campaigns.js
│   ├── leads.js
│   ├── reports.js
│   ├── dashboard.js
│   ├── call-audit.js
│   ├── leave-management.js
│   ├── crm-settings.js
│   ├── notifications.js
│   └── firebase-config.js
│
├── assets/
├── images/
├── dashboard.html
└── README.md
```

---

# 🔄 Lead Lifecycle

```
Meta Lead
      │
      ▼
Campaign Selected
      │
      ▼
Assignment Engine
      │
      ▼
Sales / HR
      │
      ▼
Status Updates
      │
      ▼
Reports
```

---

# 🔁 Assignment Flow

```
Lead Created
      │
      ▼
Campaign Assignment Role
      │
      ▼
Office Hours
      │
      ▼
Leave Check
      │
      ▼
Holiday Check
      │
      ▼
Round Robin
      │
      ▼
Assigned User
```

---

# 📱 Responsive

Fully responsive

- Desktop
- Tablet
- Mobile

---

# 🚀 Performance

✔ Real-time Firestore

✔ Optimized Queries

✔ Reusable Assignment Engine

✔ Dynamic Routing

✔ Modular Architecture

✔ Enterprise Ready

---

# 🛣 Roadmap

- Voice Calling
- AI Call Analysis
- WhatsApp API Automation
- Google Calendar Sync
- Google Meet Integration
- HR Interview Scheduling
- Resume Upload
- Driver Document Verification
- Analytics Dashboard
- Mobile App

---

# 👨‍💻 Developed For

**ABRA Logistics**

Enterprise Lead & Recruitment Management Platform

---

# 📄 License

Internal Enterprise Software

Developed exclusively for **ABRA Logistics**.

Unauthorized distribution or commercial resale is prohibited.

---

# ❤️ Built With

- JavaScript
- Firebase
- HTML5
- CSS3
- Bootstrap
- ❤️ for ABRA Logistics

---

## ⭐ Version

**Version:** 2.0 Enterprise Edition

**Status:** Production Ready

**Last Updated:** July 2026