# Sales Knowledge Center (Training Management) - Implementation Plan

## System Overview

A complete, dynamic training platform where Super Admin/Admin can create, manage, and publish training content for:
- Company Services
- Campaign Knowledge (per campaign)
- Sales Process
- CRM Usage
- Customer Handling
- Objection Handling
- Status Training
- Assignment Process

**Key Requirement**: 100% dynamic - NO hardcoded content. All training is created through the UI.

---

## Firestore Collections

### 1. `trainingCategories`
```javascript
{
  id: auto,
  name: "Campaign Training",
  description: "Learn about our service campaigns",
  icon: "bi-columns-gap",
  order: 1,
  createdBy: "uid",
  createdAt: Timestamp,
  active: true
}
```

### 2. `trainings`
```javascript
{
  id: auto,
  categoryId: "ref_to_category",
  title: "Freight Services Training",
  description: "Complete guide to Freight Services campaign",
  campaignId: "optional_campaign_ref", // if campaign-specific
  status: "draft" | "published" | "archived",
  
  // Content sections (array of objects)
  sections: [
    {
      id: "section_1",
      order: 1,
      type: "text" | "video" | "pdf" | "quiz" | "conversation" | "objections",
      title: "Overview",
      content: "...",
      
      // For video
      videoUrl: "https://...",
      videoType: "youtube" | "vimeo" | "mp4" | "drive",
      
      // For PDF
      pdfUrl: "https://...",
      pdfName: "document.pdf",
      
      // For conversation script
      conversationSteps: [
        { step: 1, stage: "Greeting", script: "..." },
        { step: 2, stage: "Requirement Gathering", script: "..." }
      ],
      
      // For objections
      objections: [
        { objection: "Price is too high", response: "..." },
        { objection: "I need time", response: "..." }
      ],
      
      // For quiz
      quizId: "ref_to_quiz"
    }
  ],
  
  isMandatory: false,
  estimatedDuration: 30, // minutes
  createdBy: "uid",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  publishedAt: Timestamp | null
}
```

### 3. `quizzes`
```javascript
{
  id: auto,
  trainingId: "ref",
  title: "Freight Services Quiz",
  passingScore: 70, // percentage
  
  questions: [
    {
      id: "q1",
      question: "Which freight service is fastest?",
      options: ["Road", "Rail", "Air", "Sea"],
      correctAnswer: 2, // index
      explanation: "Air freight is the fastest option"
    }
  ],
  
  createdBy: "uid",
  createdAt: Timestamp
}
```

### 4. `trainingProgress`
```javascript
{
  id: auto,
  userId: "uid",
  trainingId: "ref",
  status: "not_started" | "in_progress" | "completed",
  
  startedAt: Timestamp | null,
  completedAt: Timestamp | null,
  lastViewedAt: Timestamp,
  
  sectionsCompleted: ["section_1", "section_2"],
  timeSpent: 1800, // seconds
  
  // Quiz results
  quizAttempts: [
    {
      attemptedAt: Timestamp,
      score: 85,
      answers: { q1: 2, q2: 1 },
      passed: true
    }
  ],
  
  bestScore: 85,
  certificateIssued: false
}
```

### 5. `certificates`
```javascript
{
  id: auto,
  userId: "uid",
  userName: "John Doe",
  trainingId: "ref",
  trainingTitle: "Freight Services Certified",
  score: 85,
  issuedAt: Timestamp,
  certificateUrl: "generated_pdf_url" // optional
}
```

---

## File Structure

```
js/
  training.js           # Main training logic
  training-builder.js   # Admin training creation UI
  training-quiz.js      # Quiz management and taking
  
dashboard.html         # Add training view sections
css/style.css          # Add training styles
```

---

## Features Implementation

### 1. Role-Based Navigation

**Sidebar Addition:**
```html
<!-- For ALL roles -->
<a href="#" class="nav-link nav-item-link" data-view="training">
  <i class="bi bi-mortarboard-fill"></i> Sales Academy
  <span id="trainingProgressBadge" class="badge bg-info ms-auto">82%</span>
</a>
```

### 2. Member View Features

#### A. Training Dashboard
- Overall progress percentage
- Completed lessons count
- Categories grid with progress per category
- Continue learning section (last viewed)
- Recommended/Mandatory training
- My certificates

#### B. Training List (by Category)
- Browse all available trainings
- Filter by campaign
- Sort by: Newest, Popular, Mandatory
- Progress indicators
- Estimated duration
- Status badges (Not Started, In Progress, Completed)

#### C. Training Player
- Section navigation sidebar
- Content display (text, video, PDF embed)
- Mark section as complete
- Next/Previous navigation
- Progress tracking
- Download attachments
- Take quiz button

#### D. Quiz Interface
- Question display (one at a time or all)
- Multiple choice answers
- Submit quiz
- Show results with explanations
- Pass/Fail indication
- Retake option if failed
- Certificate generation on pass

#### E. Certificates Page
- List all earned certificates
- Download PDF
- Share functionality
- Display: Training Name, Date, Score

### 3. Admin View Features

#### A. Training Management Dashboard
- Total trainings count
- Published/Draft/Archived counts
- Members completion statistics
- Recently created trainings
- Create New Training button

#### B. Training List (Admin)
- All trainings (including drafts)
- Bulk actions (Publish, Archive, Delete)
- Edit/Delete buttons
- Clone training
- View analytics

#### C. Training Builder
**Section Types:**
1. **Text Content**: Rich text editor
2. **Video**: YouTube/Vimeo URL or upload MP4
3. **PDF**: Upload document
4. **Sales Conversation**: Step-by-step script builder
5. **Objection Handling**: Objection + Response pairs
6. **Quiz**: Question builder

**Builder Features:**
- Drag & drop section reordering
- Add/Remove sections
- Preview mode
- Save as draft
- Publish
- Campaign association

#### D. Quiz Builder
- Add questions
- Multiple choice (4 options)
- Set correct answer
- Add explanation
- Set passing score
- Reorder questions

#### E. Category Management
- Create category
- Edit category
- Set icon
- Set order
- Activate/Deactivate

#### F. Analytics & Reports
- Training completion by member
- Average scores
- Time spent per training
- Campaign-wise completion
- Export to CSV

### 4. Campaign Integration

**When creating a campaign, prompt:**
```
"Would you like to create training for this campaign?"
[Yes - Open Training Builder] [No] [Later]
```

**Training auto-linked to campaign:**
- Campaign details pre-filled
- Training appears in "Campaign Training" category
- Members see it when assigned to campaign leads

---

## UI Components

### Training Card
```html
<div class="training-card">
  <div class="training-card-badge">Campaign</div>
  <div class="training-card-icon">
    <i class="bi bi-truck"></i>
  </div>
  <h5 class="training-card-title">Freight Services</h5>
  <p class="training-card-desc">Learn all about freight services...</p>
  <div class="training-card-meta">
    <span><i class="bi bi-clock"></i> 30 min</span>
    <span><i class="bi bi-file-text"></i> 5 lessons</span>
  </div>
  <div class="training-card-progress">
    <div class="progress">
      <div class="progress-bar" style="width: 60%"></div>
    </div>
    <span class="training-card-progress-text">60% complete</span>
  </div>
  <button class="btn btn-primary btn-sm w-100">Continue Learning</button>
</div>
```

### Progress Dashboard
```html
<div class="training-stats-grid">
  <div class="training-stat-card">
    <div class="training-stat-icon"><i class="bi bi-check-circle"></i></div>
    <div class="training-stat-value">12/15</div>
    <div class="training-stat-label">Completed</div>
  </div>
  <div class="training-stat-card">
    <div class="training-stat-icon"><i class="bi bi-clock-history"></i></div>
    <div class="training-stat-value">8.5 hrs</div>
    <div class="training-stat-label">Time Spent</div>
  </div>
  <div class="training-stat-card">
    <div class="training-stat-icon"><i class="bi bi-award"></i></div>
    <div class="training-stat-value">5</div>
    <div class="training-stat-label">Certificates</div>
  </div>
</div>
```

---

## Security Rules (Firestore)

```javascript
// trainingCategories
allow read: if request.auth != null;
allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['superadmin', 'admin'];

// trainings
allow read: if request.auth != null && resource.data.status == 'published';
allow read: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['superadmin', 'admin'];
allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['superadmin', 'admin'];

// trainingProgress
allow read: if request.auth.uid == resource.data.userId;
allow write: if request.auth.uid == request.resource.data.userId;

// certificates
allow read: if request.auth.uid == resource.data.userId;
allow create: if request.auth.uid == request.resource.data.userId;
```

---

## Implementation Phases

### Phase 1: Core Structure ✓
- Firestore collections
- Firebase references
- Basic data loading
- Member navigation

### Phase 2: Member View
- Training dashboard
- Category browse
- Training list
- Training player
- Progress tracking

### Phase 3: Quiz System
- Quiz builder (admin)
- Quiz taking (member)
- Score calculation
- Certificate generation

### Phase 4: Admin Features
- Training builder
- Category management
- Analytics dashboard
- Member progress reports

### Phase 5: Advanced Features
- AI Role Play integration
- Video uploads (Firebase Storage)
- PDF uploads
- Certificate PDF generation

### Phase 6: Campaign Integration
- Link training to campaigns
- Auto-prompt on campaign creation
- Campaign-specific training views

---

## Next Steps

1. Update firebase-config.js with training refs
2. Create training.js with core functions
3. Add Training view to dashboard.html
4. Create training CSS
5. Build member training view
6. Build admin training builder
7. Integrate with campaigns.js

**Status: Ready to implement**
