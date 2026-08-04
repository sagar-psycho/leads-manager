# Abra Zylo AI SEO Generator

<p align="center">
  <strong>AI-powered eCommerce SEO generation, validation, auditing, and product optimization for Abra Zylo</strong>
</p>

<p align="center">
  Built for <strong>product SEO workflows</strong> that move from generation to validation, audit, campaign preparation, and Meta catalog readiness.
</p>

---

## What is Abra Zylo AI SEO Generator?

Abra Zylo AI SEO Generator is a web-based SEO platform for eCommerce product workflows. It combines AI-assisted content generation, deterministic SEO scoring, field-level improvement, SEO audits, Google PageSpeed analysis, product management, sale campaign preparation, and Meta Product Catalog organization in one portal.

## Key SEO Features

- AI-powered meta title and meta description generation
- SEO-friendly URL and slug generation
- Focus keyword generation and product description generation
- Field-level AI regeneration for weak SEO sections
- Internal SEO scoring that evaluates title, description, URL, keywords, and content completeness
- SEO audit workflows for page-level on-page checks
- Google PageSpeed and Lighthouse performance analysis
- Product management and SEO history tracking
- Sale campaign preparation and Meta Product Catalog workflows

## AI SEO Generator

The generator uses product images, product names, categories, and optional product metadata to create structured SEO content. The workflow supports multiple AI providers including Groq, Google Gemini, and OpenRouter.

## SEO Scoring & Validation

Every generated result is evaluated using the portal’s own scoring logic. The score is recalculated after targeted improvements and only reaches the save threshold when the content satisfies the configured quality checks.

## SEO Audit

The app includes an SEO checker for page title, meta description, focus keyword, content, and URL signals. It also provides a performance audit workflow powered by Google PageSpeed Insights and Lighthouse.

## PageSpeed & Core Web Vitals

The performance experience analyzes Lighthouse report data across Performance, Accessibility, Best Practices, and SEO. It also surfaces Core Web Vitals data such as Largest Contentful Paint, Cumulative Layout Shift, First Contentful Paint, Speed Index, and Time to First Byte.

## Product Management

The platform includes a product management workflow for storing product details, images, model numbers, pricing context, and SEO generation progress. Products can be reused across SEO generation, campaigns, and catalog preparation.

## AI Providers

The portal supports provider selection for:

- Groq
- Google Gemini
- OpenRouter

## Sale Campaigns

The marketing module includes sale campaign creation and campaign-item organization for promotional workflows.

## Meta Product Catalog

The Meta Product Catalog module helps organize products for catalog-style workflows and campaign-ready product preparation.

## Technology Stack

- Frontend: HTML, CSS, JavaScript
- Authentication: Firebase Authentication
- Database: Cloud Firestore
- Media: Cloudinary
- AI: Groq, Google Gemini, OpenRouter
- Performance: Google PageSpeed Insights, Lighthouse

## Getting Started

Open the project in a browser and load the landing page. Signed-in users can enter the authenticated portal to use the SEO generator, audits, products, campaigns, and settings modules.

## Screenshots

The repository includes a project preview image at [abra-zylo-seo-portal.png](abra-zylo-seo-portal.png).

## Architecture

The application is structured around a public marketing layer and an authenticated portal layer. The public page is designed for discoverability, while the existing portal preserves the current application experience after authentication.

## Project Structure

- [index.html](index.html)
- [css](css)
- [js](js)
- [sitemap.xml](sitemap.xml)
- [robots.txt](robots.txt)

---

# ✨ Core Features

## 🤖 1. AI SEO Content Generator

Generate complete SEO content for ABRA ZYLO products using AI.

The generator can work with:

- Product image
- Product name
- Product category
- Output language
- Additional product information

The system analyzes the product information and generates structured SEO content.

### Generated SEO Content

The platform can generate:

- Meta Title
- Meta Description
- Focus Keywords
- Image Alt Text
- Product Description
- Short Description
- SEO-Friendly URL / Slug
- Product Tags
- Social Media SEO Content
- OpenCart-ready SEO information

---

# 📸 AI Product Understanding

Product images can be used as part of the SEO generation workflow.

When a product is loaded into the generator, the associated product image and available product information can be used to provide better context for SEO content generation.

This helps the system create content that is more closely aligned with the actual product.

---

# 📊 SEO Score System

Every generated product can be evaluated using an SEO scoring system.

Example:

```text
SEO Score
83 / 100

Good SEO
```

The score helps identify whether generated SEO content meets the configured optimization requirements.

The SEO checklist can evaluate items such as:

- Meta Title length
- Meta Description length
- Product keyword in Meta Title
- Product keyword in Meta Description
- Product keyword in SEO slug
- Product keyword in Image Alt Text
- Call-to-action usage
- Meta Title quality
- Meta Description quality
- Keyword relevance
- Content completeness

The score is recalculated whenever supported SEO content is successfully improved.

---

# ✨ AI Improve

Instead of regenerating the entire SEO output, individual fields can be improved using the **AI Improve** feature.

Supported fields can include:

```text
Meta Title            → ✨ AI Improve
Meta Description      → ✨ AI Improve
Focus Keywords        → ✨ AI Improve
Image Alt Text        → ✨ AI Improve
Product Description   → ✨ AI Improve
```

The system attempts to regenerate only the selected field.

After a successful improvement:

```text
Previous SEO Score
74 / 100

↓

AI Improve

↓

Updated SEO Score
83 / 100

+9 Improvement
```

This allows SEO content to be optimized progressively without unnecessarily replacing already-good content.

---

# 🔄 Full Regenerate

When required, users can regenerate the complete SEO output instead of improving individual fields.

The **Full Regenerate** feature rebuilds the generated SEO content using the available product information.

This is useful when:

- Product information changes
- Existing content is unsuitable
- A completely different SEO direction is required
- Multiple SEO fields require improvement

---

# 🧠 SEO Improvement Validation

AI-generated improvements are validated before replacing existing content.

The application is designed to avoid replacing existing SEO content with a clearly worse candidate.

If an improvement cannot satisfy the required validation after the configured attempts, the original content can be preserved.

Example:

```text
Unable to generate a valid improvement after 3 attempts.
Your original content has been preserved.
```

This prevents unsuccessful AI generations from automatically overwriting usable SEO content.

---

# 🛍️ Product Management

The portal includes centralized product management for ABRA ZYLO.

Users can manage products and reuse their information across different marketing and SEO workflows.

Product information can include:

- Product name
- Product image
- Category
- SEO status
- Generated SEO content
- Campaign information
- Product metadata

Products can be loaded directly into the SEO generator, reducing duplicate data entry.

---

# 🏷️ Sale Campaign Management

The platform includes a dedicated **Sale Campaigns** module.

This module helps organize products being prepared for promotional campaigns.

Campaign products can include information such as:

- Product image
- Product name
- MRP
- Sale price
- Discount percentage
- Savings
- Campaign status
- SEO generation status
- Creation date

Users can open a campaign product and send it directly to the SEO generation workflow.

---

# 📢 Meta Product Catalog

The **Meta Product Catalog** section helps organize ABRA ZYLO products intended for Meta advertising/catalog workflows.

Products can be categorized based on workflow status.

Example statuses:

```text
Pending
Completed
Added
```

Users can:

- View product information
- Review generated content
- Track catalog preparation
- Mark products as added
- Copy required product information

This provides a structured workflow between product SEO preparation and Meta Catalog management.

---

# 🔎 SEO Audit Tool

The application includes an SEO Audit section for analyzing ABRA ZYLO website performance and SEO.

The audit system contains dedicated analysis capabilities for website performance and SEO checks.

---

# ⚡ Real-Time Performance Audit

The Real-Time Performance Audit integrates with Google's performance auditing ecosystem to analyze ABRA ZYLO pages.

The audit can evaluate:

- Performance
- Accessibility
- Best Practices
- SEO

Example report:

```text
Performance       22
Accessibility     65
Best Practices    92
SEO               92
```

Both supported device strategies can be used:

```text
📱 Mobile
🖥️ Desktop
```

---

# 🎯 ABRA ZYLO Domain Restriction

The performance audit functionality is designed specifically for the ABRA ZYLO website.

Authorized domain:

```text
https://abra-zylo.com/
```

Product URLs and other pages under the ABRA ZYLO domain can be analyzed.

Example:

```text
https://abra-zylo.com/product-page
```

External websites are rejected because this implementation is intended specifically for ABRA ZYLO.

Example:

```text
This product is only built for ABRA ZYLO, not for example.com.
This product is fully trained only for ABRA ZYLO.
```

---

# 🤖 AI Performance Analysis

Performance audit results can optionally be analyzed using the configured AI providers.

The AI layer can help transform technical audit information into easier-to-understand recommendations and potential action items.

The goal is to help identify:

- Performance issues
- SEO problems
- Accessibility improvements
- Technical optimization opportunities
- Recommended fixes

---

# 📜 SEO History

Generated SEO records can be stored in the application's history system.

This allows previously generated content to be reviewed instead of regenerating everything from scratch.

History records can include generated SEO information and related product data.

---

# 🕐 Audit History

Performance and SEO audit reports can be saved for future reference.

This makes it easier to compare previous audit results and track website optimization work over time.

---

# 📊 Dashboard

The dashboard provides a centralized overview of the platform.

It can display information such as:

- Total Products
- Recent SEO activity
- Generated products
- SEO history
- Total Audits
- Average Audit Score
- Supported Languages
- Firebase Status
- Recent activity
- Quick actions

The dashboard acts as the main control center for the SEO workflow.

---

# 🌐 Multi-Language Support

The portal includes language options for supported SEO workflows.

Current interface options include:

```text
EN – English
HI – Hindi
TE – Telugu
```

The architecture can be extended with additional languages in the future.

---

# 🔥 Firebase Integration

Firebase is used as part of the application's backend infrastructure.

Depending on the module, Firebase supports functionality such as:

- Authentication
- Product storage
- SEO content storage
- Campaign data
- Audit history
- User-specific information
- Application synchronization

This allows generated SEO content and application data to persist across sessions.

---

# 👤 Authentication & Accounts

The application contains an account-based authentication system.

Authenticated users can access platform features based on the application's configured account permissions.

The sidebar account area provides access to user-related functionality and settings.

---

# 🔐 AI Provider Configuration

The application supports configurable AI providers.

Current integrations include support for:

### Groq

Used for fast AI-powered generation and analysis workflows.

### Google Gemini

Used as an additional AI provider for supported generation and analysis tasks.

### OpenRouter

Provides access to compatible AI models through the OpenRouter API.

The system is designed so individual AI providers can maintain independent API configuration.

---

# 🔑 API Key Management

API credentials can be configured through the application's Settings section.

Supported configuration can include:

```text
Groq API Key
Google Gemini API Key
OpenRouter API Key
```

API credentials should never be committed directly to the public GitHub repository.

---

# 🔒 Security

API keys and sensitive credentials must never be hardcoded into source files committed to GitHub.

Never commit:

```text
Gemini API keys
Groq API keys
OpenRouter API keys
Firebase private credentials
Service-account credentials
Passwords
Authentication tokens
```

Use environment variables, protected backend configuration, or the application's secure configuration mechanism where applicable.

If an API credential is accidentally exposed publicly, revoke it immediately and generate a replacement.

---

# 🧩 Main Application Modules

The application is organized around the following major modules:

```text
ABRA ZYLO AI SEO Portal
│
├── 📊 Dashboard
│
├── ⚡ Generate SEO
│
├── 🕐 History
│
├── 🔎 SEO Audit
│   ├── Performance
│   └── SEO Checker
│
├── 🕐 Audit History
│
├── 🤖 AI Marketing
│   ├── Products
│   ├── Sale Campaigns
│   └── Meta Product Catalog
│
└── 👤 Account
    ├── Accounts
    └── Settings
```

---

# 🔄 Product SEO Workflow

A typical workflow inside the platform is:

```text
Product Added
      ↓
Product Image + Information
      ↓
Select Product Category
      ↓
Generate SEO
      ↓
AI Generates SEO Content
      ↓
SEO Validation
      ↓
SEO Score
      ↓
Identify Failed Checks
      ↓
AI Improve
      ↓
Recalculate SEO Score
      ↓
Save SEO Content
      ↓
SEO History
      ↓
Use for ABRA ZYLO / OpenCart / Marketing
```

---

# 📢 Marketing Workflow

Products can also move through the marketing workflow:

```text
Product
   ↓
Sale Campaign
   ↓
Generate / Improve SEO
   ↓
Campaign Content
   ↓
Meta Product Catalog
   ↓
Mark Added
```

This helps connect SEO preparation with ABRA ZYLO's advertising workflow.

---

# 🛠️ Technology Stack

The project uses modern web technologies and cloud services.

### Frontend

```text
HTML5
CSS3
JavaScript
Responsive Web Design
```

### Backend / Cloud

```text
Firebase
Firebase Authentication
Cloud Database / Application Storage
```

### AI

```text
Groq
Google Gemini
OpenRouter
```

### SEO & Performance

```text
Google PageSpeed Insights
Lighthouse-based Performance Analysis
Custom SEO Scoring
Custom SEO Validation
```

### Version Control & Deployment

```text
Git
GitHub
GitHub Pages
```

---

# 📁 Project Structure

The exact structure may evolve as the platform grows, but the application follows a modular architecture similar to:

```text
abra-zylo-seo-generator/
│
├── index.html
│
├── css/
│   └── ...
│
├── js/
│   ├── seo-generator.js
│   └── ...
│
├── assets/
│   ├── images/
│   └── ...
│
├── README.md
│
└── ...
```

---

# 🚀 Running the Project Locally

Clone the repository:

```bash
git clone <repository-url>
```

Enter the project directory:

```bash
cd abra-zylo-seo-generator
```

Open the project using VS Code:

```bash
code .
```

Because the application uses browser APIs, Firebase, and external services, running it through a local development server is recommended.

For example, VS Code Live Server or another local HTTP server can be used.

---

# ⚙️ Configuration

Before using AI-powered functionality, configure the required services.

Depending on the enabled features, this can include:

```text
Firebase
Groq
Google Gemini
OpenRouter
Google PageSpeed Insights
```

Do not place production secrets directly inside publicly accessible frontend files.

---

# 🧪 Recommended Testing

Before deploying a new version, verify the following workflows:

- User authentication
- Dashboard loading
- Product loading
- Product image loading
- SEO generation
- SEO score calculation
- AI Improve
- Full Regenerate
- SEO History
- Sale Campaign loading
- Meta Product Catalog
- SEO Audit
- Performance Audit
- Audit History
- Firebase synchronization
- AI provider configuration
- Mobile responsiveness

Also verify that opening and closing modals does not leave the document scroll locked.

---

# 🎯 Project Objective

The objective of ABRA ZYLO – AI SEO Portal is to build a dedicated AI-powered SEO ecosystem for ABRA ZYLO rather than relying entirely on disconnected third-party SEO tools.

The platform aims to bring together:

```text
Product Data
      +
Artificial Intelligence
      +
SEO Validation
      +
Performance Auditing
      +
Marketing Workflows
      +
Cloud Storage
```

into one centralized application.

---

# 🔮 Future Development

Potential future improvements include:

- Google Search Console integration
- Google Analytics integration
- Keyword ranking tracking
- Competitor keyword research
- Search-volume integration
- Automatic product SEO synchronization
- OpenCart API integration
- Bulk SEO generation
- Bulk AI Improve
- SEO issue prioritization
- Product-level SEO analytics
- SEO performance trends
- Automated sitemap monitoring
- Indexing status monitoring
- Merchant listing optimization
- Google Merchant Center integration
- Meta Catalog synchronization
- AI-powered internal linking
- Duplicate content detection
- Broken link monitoring
- Automated SEO reports
- Advanced role-based access control

---

# ⚠️ Important

This platform is developed specifically for:

## ABRA ZYLO

The SEO logic, product workflows, performance auditing, campaign workflows, and AI-assisted functionality are designed around the ABRA ZYLO e-commerce ecosystem.

The platform should not be considered a general-purpose public SEO auditing service.

---

# 👨‍💻 Development

Developed as an internal AI-powered SEO and digital marketing technology project for **ABRA ZYLO**.

The project combines:

**SEO + Artificial Intelligence + E-commerce + Performance Auditing + Marketing Automation**

to create a centralized product optimization workflow.

---

<p align="center">
  <strong>ABRA ZYLO – AI SEO Portal</strong>
</p>

<p align="center">
  AI Powered SEO • Smarter Rankings
</p>

<p align="center">
  🔍 SEO &nbsp; • &nbsp; 🤖 AI &nbsp; • &nbsp; 🛍️ E-commerce &nbsp; • &nbsp; 📊 Analytics
</p>