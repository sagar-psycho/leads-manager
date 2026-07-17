# 🚚 ABRA Logistics CRM

![Version](https://img.shields.io/badge/Version-v2.0-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Production_Ready-success?style=for-the-badge)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=for-the-badge&logo=javascript)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange?style=for-the-badge&logo=firebase)
![Enterprise](https://img.shields.io/badge/Enterprise-CRM-blueviolet?style=for-the-badge)
![License](https://img.shields.io/badge/License-Internal-red?style=for-the-badge)

> Enterprise Lead Management & Sales Automation Platform for ABRA
> Logistics

## Overview

ABRA Logistics CRM is an enterprise-grade CRM for logistics, sales,
driver recruitment, reporting, campaign management and workflow
automation.

## Key Features

  Module                 Status
  --------------------- --------
  Lead Management          ✅
  Campaign Management      ✅
  Assignment Engine        ✅
  HR Recruitment           ✅
  Reports                  ✅
  Call Audit               ✅
  Leave Management         ✅
  Sales Academy            ✅
  Notifications            ✅

## Architecture

``` text
Firebase Auth
      │
Cloud Firestore
      │
Business Logic
      │
Assignment ─ Reports ─ Dashboard ─ Campaigns
      │
 Sales      HR
```

## Lead Workflow

``` text
Lead Created
     │
Campaign
     │
Assignment Role
     │
Assignment Engine
     │
Sales / HR
     │
Reports
```

## Tech Stack

-   HTML5
-   CSS3
-   JavaScript
-   Bootstrap
-   Firebase Authentication
-   Cloud Firestore
-   Firebase Hosting

## Project Structure

``` text
dashboard.html
css/
js/
assets/
images/
README.md
```

## License

Internal Enterprise Software for ABRA Logistics.
