# Physics IDE — Classroom Platform

**What this document is.** A complete, plain-language description of everything the new system will do. No code has been written and no technical plan exists yet — that is deliberate. You read this, mark up anything that is wrong or missing, and only once you approve it do I write the build plan. Sections are numbered so you can say "change 6.3" instead of quoting paragraphs.

**The four decisions you have already made** (baked in throughout):

1. **Anyone can sign up as a teacher.** No gatekeeping at the door; the admin can switch off an account if the openness is abused.
2. **Anticheat is the light version.** The system keeps a complete, tamper-proof record of who made, shared and submitted what, and when — but it does not scan for copied work or watch how students type.
3. **Work survives bad internet.** Everything saves to the student's computer first and syncs up when the connection returns.
4. **The free, no-login IDE stays.** Anyone can still open the IDE and experiment, exactly like today.

And the two standing constraints: **at most 200 people**, and **nothing may consume more resources than necessary**. The whole design is shaped around both.

**Revision 2 (18 August 2026)** — reworked after your first review: pair/group submissions added (5.5), teaching assistants added (section 2), you now get an email whenever a teacher signs up (3.1), and teachers control which tools students may use per assignment, with import/export off by default for class work (5.4).

---

## 1. The big picture

Today, the Physics IDE is a website where anyone can build physics simulations and do data analysis in their browser. It is genuinely good at that — and none of it changes. The block editor, the code editor, the 3D viewport, the data panel, the templates, the built-in datasets: all untouched. Physics still runs on the student's own computer, never on a server.

What is being added is **the classroom around the IDE**:

- People get **accounts**, so work belongs to someone and follows them between computers.
- Teachers create **classrooms** and students join them — by email invite, class code, link, or QR code.
- Teachers post **assignments** with rich instruction pages (text, headings, images, videos) and optional starter projects.
- Students **submit** work; teachers **open it, run it, debug it**, mark it, and send feedback.
- Every piece of work carries an honest **paper trail** — who made it, when, and how it grew.

Think of it as: the IDE is the science lab, and we are building the school around the lab.

---

## 2. The people

Five kinds of people use the system:

| Person | Who they are | In one sentence |
|---|---|---|
| **Guest** | Anyone who opens the site without signing in | Full IDE, nothing saved beyond their own browser — exactly today's experience. |
| **Student** | A signed-in learner | Joins classes, does assignments, submits work, sees marks and feedback. |
| **Teacher** | A signed-in educator | Creates classes and assignments, reviews and marks work, manages their students. |
| **Teaching assistant** | A helper invited into a specific class by its teacher | Reviews, runs and debugs submissions and drafts marks and feedback — but nothing they do reaches students until a teacher approves and releases it. |
| **Site admin** | You (or whoever runs the installation) | Oversees accounts and the health of the whole system. |

Notes:

- A class can have **more than one teacher** (a co-teacher invited by the first teacher), and any number of **teaching assistants**.
- A teaching assistant is invited by email into one class at a time — it is a per-class helper hat, not an account type someone signs up as. The same person can be a TA in one class and a student or teacher elsewhere.
- The dividing line is simple: **TAs prepare, teachers decide.** TAs can open and run any submission, use every marking tool, write feedback and suggest marks — all saved as drafts. Publishing assignments, releasing marks, and changing the roster or settings are teacher-only.
- One person can be a teacher in one class and a student in another (useful for testing, and harmless).
- There is **no parent/guardian access** in this version.

### 2.1 Who can do what

| Capability | Guest | Student | TA | Teacher | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Use the full IDE (physics, data science, hybrid) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Save projects to their account (cloud) | — | ✓ | ✓ | ✓ | ✓ |
| Join a class | — | ✓ | invited | — | — |
| Create classes and assignments | — | — | — | ✓ | ✓ |
| Submit work for marking | — | ✓ | — | — | — |
| Open, run and debug submissions | — | — | ✓ (their class) | ✓ (own classes) | — |
| Draft marks and feedback | — | — | ✓ | ✓ | — |
| Publish assignments, release marks, manage roster | — | — | — | ✓ | — |
| See the gradebook | — | own marks only | ✓ (their class) | ✓ (own classes) | — |
| Deactivate accounts, see system health | — | — | — | — | ✓ |

---

## 3. Doors into the system

### 3.1 Signing up

The front page offers three doors: **Try the IDE** (guest, no account), **I'm a student**, and **I'm a teacher**.

- Signing up asks for the minimum: name, email address, password. No phone numbers, no photos, no birthdays.
- The system sends a **confirmation email** with a button to prove the address is real. Until confirmed, a person can look around but cannot join a class or submit work.
- Passwords are stored in scrambled form that nobody — including us — can read back. There is a **Forgot password** flow that emails a reset link.
- Per your decision, the teacher door is open: anyone may choose it. Two safety valves: **every teacher signup immediately sends you (the admin) an email** — name, email address, and time, with a link straight to that account in the admin console — so an unexpected teacher never goes unnoticed; and the **admin can deactivate any account**, which instantly signs it out everywhere and freezes its classes. Worth saying once, honestly: an open door means a student *could* create a teacher account on the side. It would not help them cheat — a teacher account has no power over a class it doesn't own — but you should know the door is open by design, and you will hear about every use of it.
- **Signup cap: 200 accounts.** Signup number 201 is politely refused ("This site is at capacity — ask your teacher or the site owner."). The admin can raise or lower the cap. This is the hard guarantee behind "no more resources than necessary" — nobody can quietly grow the system past what it was sized for.

### 3.2 Guests becoming members

When a guest signs up, the system notices any projects saved in their browser and offers: **"Bring your 3 guest projects into your new account?"** One click, and work they did before joining is preserved. Declining leaves the projects where they were.

### 3.3 Students joining a class

Four ways in, all leading to the same place:

1. **Email invite.** The teacher types or pastes email addresses (or uploads a simple list). Each person gets an invitation email with a **Join class** button. If they don't have an account yet, the button walks them through signup first, then lands them in the class automatically.
2. **Class code.** Every class has a short code like `KQ4-7PM` (letters and digits chosen so none look alike). A student clicks **Join a class**, types the code, done.
3. **Join link.** The same code as a shareable link — paste it into WhatsApp, email, or a slideshow.
4. **QR code.** The class page can display a large QR code for projecting onto the board; students scan it with their phones and are taken to the join link.

Teacher controls: regenerate the code at any time (the old one stops working), or **pause joining** entirely once the roster is complete. Optionally, the teacher can require **approval** — new joiners sit in a "waiting" list until confirmed, which prevents strangers wandering in via a leaked code.

---

## 4. Classrooms

A teacher's home screen is a wall of class cards. Creating a class asks only for a name (e.g., "Grade 11 Physical Sciences — 2027") and an optional subject/year label.

Inside a class, the teacher sees four tabs:

| Tab | What lives there |
|---|---|
| **Assignments** | Every assignment, current and past, with submission counts at a glance. |
| **People** | The roster: students (with invited/joined status), co-teachers, teaching assistants, the join code/link/QR panel, invite tools, remove/re-invite buttons. |
| **Gradebook** | The class grid — students down the side, assignments across the top, marks in the cells. Export as a spreadsheet file with one click. |
| **Settings** | Class name, joining rules (open/approval/paused), sharing rules (see section 8.3), archive class. |

Other classroom facts:

- **Guides.** Besides assignments, a teacher can publish standalone **guide pages** to a class — the same rich pages as assignment instructions (section 5.2) but not tied to any submission. Good for "How we name variables", "Setting up your first simulation", safety rules, revision notes.
- **Removing a student** takes them off the roster but never deletes their work — their projects stay in their own account; their past submissions stay with the class record.
- **Archiving a class** at year-end makes it read-only for everyone. Marks and submissions remain viewable; nothing new can be added. Archived classes sit in a collapsed "Archived" shelf, not cluttering the wall.

---

## 5. Assignments

### 5.1 What an assignment is

One assignment = **an instructions page + an optional starter project + a handful of settings.**

Settings, all optional except the title:

- **Open date** — before it, students can't see it (or can see it but not start; teacher's choice).
- **Due date** — the deadline shown everywhere.
- **Late window** — if switched on, submissions are accepted after the due date but permanently wear a "late" label; the teacher picks the final cut-off.
- **Points** — what the work is marked out of (e.g., out of 20). Marks can also be switched off entirely for practice tasks ("complete / not complete").
- **Resubmission** — allowed until the deadline by default; each resubmit replaces the previous one, but the earlier attempts remain in the record.
- **Who submits** — individuals (the default), pairs, or groups up to a teacher-chosen size (section 5.5).
- **Workspace rules** — which tools and editors students get while working on this assignment (section 5.4).
- **Individual work flag** — stamps the assignment "individual work" for students and switches off peer sharing for it (section 8.3). Only applies to individually-submitted assignments.

An assignment moves through a simple life: **Draft** (only teachers see it) → **Published** → **Due** → **Closed** → **Marks released**. The teacher can step it forward manually or let the dates do it.

### 5.2 The instructions editor

This is where the teacher explains the task. It is a friendly page editor — think "writing a nicely formatted worksheet", not "building a website":

- **Headings and text**, bold/italic, bullet and numbered lists, links.
- **Images** — uploaded from the teacher's computer (photos of apparatus, diagrams, screenshots). Stored by the system, size-capped so the storage bill stays tiny.
- **Videos** — embedded by pasting a YouTube or Vimeo link; the video plays inside the page. The system deliberately does **not** host video files itself — that is the single easiest way to blow up storage costs, and embedding is free.
- **Callout boxes** — highlighted notes like "Hint", "Warning", "Remember".
- **Equations** — typed in standard maths notation and rendered properly (this is a physics tool, after all).
- **File attachments** — a PDF worksheet or a CSV dataset students will need, size-capped.
- A live **preview** showing exactly what students will see, and the page **autosaves as a draft** while the teacher types.

### 5.3 Starter projects

A teacher can attach a starting point: they build it in the IDE themselves (blocks or code — for example, a half-finished pendulum with the forces left blank) and pin it to the assignment. Every student who starts the assignment gets **their own private copy** of it. No starter project means students begin from a blank project of the type the teacher chose (Physics, Data Science, or Hybrid).

### 5.4 Workspace rules — what students can use, per assignment

When students work on their own free projects, they get the whole IDE. When they work **inside an assignment**, the teacher decides what the workspace offers. This is set per assignment, in the assignment editor, and covers:

- **Project type** — Physics simulation, Data Science, or Hybrid (already chosen with the starter project, section 5.3).
- **Editors** — blocks only, code only, or both.
- **Debug mode** — the pause/step/inspect tools: on or off.
- **Import** — bringing outside files in ("Open…" for project bundles, uploading own CSV datasets): **off by default** for assignment work, per your decision.
- **Export & copy** — downloading work as files, PDFs, screenshots, and copy-to-clipboard: **off by default** for assignment work. (Submitting is never affected — that is not an export.)
- **Advanced blocks** — the Advanced drawer, including Raw Python: on or off.
- **Templates** — browsing the built-in example templates from inside the assignment: off by default (the starter project *is* the intended starting point).

To keep this quick, the editor offers **ready-made rule sets**:

| Rule set | What it means |
|---|---|
| **Open practice** | Everything on — the assignment behaves like a free project. |
| **Standard classwork** *(the default)* | Import, export and templates off; both editors, debug and advanced blocks on. |
| **Locked-down assessment** | Import, export, copy, templates, advanced blocks and debug all off — just the chosen editor(s) and Run. |
| **Custom…** | The teacher flips the switches themselves — and can **save their combination under their own name** (e.g., "Gr11 practicals") to reuse on any future assignment in any of their classes. |

Facts about how the rules behave:

- Every assignment **remembers its own rules permanently**, and a teacher's saved custom sets live in their account until they delete them.
- Switched-off tools **disappear from the workspace entirely** — no greyed-out temptations — and the system also refuses them behind the scenes, so the rules can't be dodged by a resourceful student.
- Rules apply **only inside that assignment's workspace**. The same student's personal projects, and other assignments, are untouched.
- The teacher can change the rules even after publishing; students get the new rules the next time they open the work.
- Students always see a small note in the workspace listing what their teacher has switched off — rules are visible, never silent.

### 5.5 Pairs and groups

If the teacher sets **Who submits** to pairs or groups:

- **Forming groups** happens either way the teacher prefers: students group themselves from the class list (first-come, capped at the group size), or the teacher arranges the groups by hand. The teacher can always adjust either way's result.
- The group works on **one shared project**. To avoid two people silently overwriting each other, the project passes like a baton: while one member has it open for editing, the others see it read-only with a note ("Thabo is working on it now") and a **Take over** button for when the baton-holder forgets to close it. Nothing is ever lost to a collision — the history keeps every checkpoint, labelled with **who saved it**.
- **Any member can press Submit** for the group. The snapshot credits every member by name, every member gets the receipt email, and the assignment shows as submitted for all of them.
- **One mark for the group** by default, with the teacher free to adjust an individual member's mark up or down where contribution clearly warrants it. Feedback comments go to the whole group.
- The honesty layer (section 8) applies per person: the project's timeline shows which member made each checkpoint, so "who actually did the work" has an answer when a teacher needs one.

---

## 6. The student's experience

### 6.1 Home

A student's home screen shows: their classes, a **"Due soon"** strip across the top, and a **"Recent feedback"** list (marks and comments that came back lately). Plus their own free projects — the IDE remains theirs for personal tinkering, independent of any class.

### 6.2 Doing an assignment

Opening an assignment shows the teacher's instructions page with one big button: **Start work** (or **Continue**). For pair/group assignments, this is also where students pick or see their group (section 5.5). The IDE opens with the instructions available in a side panel that can be shown, hidden, or popped out — so the task brief and the work sit side by side, no tab-juggling.

Inside an assignment, the workspace follows the teacher's rules from section 5.4 — a small note lists anything that's switched off ("Your teacher has turned off: import, export"), so students always know where the edges are and why a button they know from free projects isn't there.

### 6.3 Saving — the part that must never fail

- Work saves **automatically every few seconds to the student's own computer**, exactly as the IDE does today.
- Whenever the internet is available, it also syncs quietly **to their account in the cloud**. A small status chip shows the truth at all times: *"Saved on this computer · Synced"* or *"Saved on this computer · Waiting for connection"*.
- If the Wi-Fi dies mid-lesson (or load-shedding hits), **nothing changes for the student**. They keep working; the sync catches up when the connection returns — even if that's after they've gone home.
- Because work lives in their account, a student can start at school and continue at home on a different computer.
- If the same project is edited on two machines and the versions collide, the **most recent edit wins**, and the other version is kept safely in history — nothing is ever silently destroyed.
- Every project has a **history**: regular checkpoints the student can look back through and restore ("it worked yesterday!"). This same history is part of the integrity story (section 8).

### 6.4 Submitting

- The student presses **Submit** and confirms. The system takes an exact **snapshot** of the project at that moment — blocks, code, charts, everything — and that frozen copy is the submission.
- The student can keep tinkering afterwards without affecting what was handed in. If resubmission is allowed and the deadline hasn't passed, **Resubmit** replaces the submission with a new snapshot (previous ones stay in the record).
- They get an on-screen confirmation and a **receipt email** — their proof of submission, with the date and time.
- After the due date, the assignment either refuses submissions or accepts them with the permanent **late** label, per the teacher's late-window setting.

### 6.5 Marks and feedback

When the teacher releases marks, the student sees — on their dashboard and by email — the mark, the teacher's written comment, and any note asking them to revise and resubmit. A **My marks** page per class lists everything in one place.

---

## 7. The teacher's marking room

This is the part you asked to be genuinely integrated — teachers running and debugging student work, not just reading it.

### 7.1 The submissions inbox

Each assignment has an inbox: every student on one screen, filterable by **Submitted / Late / Missing / Marked**. Missing students can be sent a **one-click reminder email**. A progress bar shows "17 of 30 submitted" at a glance.

### 7.2 Opening a student's work

Clicking a submission opens it **in the full IDE** — the same blocks, code, 3D viewport, data panel and debug tools the student had:

- The teacher can **press Run** and watch the simulation, exactly as the student built it.
- They can use **debug mode**: pause, step through, watch variables change, inspect the trace — every diagnostic tool in the IDE works on the submission.
- The submission itself is **read-only and untouchable** — it is the exam script. But the teacher works in a **test copy** alongside it, where they can freely poke, tweak a value, fix a line to test a theory ("does it work if the mass is positive?") without altering the record in any way.
- **Previous / Next** buttons move straight to the next student's work without going back to the inbox — marking thirty scripts is a flow, not thirty round trips.

### 7.3 Marking

Alongside the work sits a marking panel: the **mark** (out of the assignment's points), a **comment box** for feedback, a **private note** space only the class's teachers and TAs ever see, and a **Return for changes** button that sends the work back with the comment attached, inviting a resubmission.

For group submissions, the panel shows all the members, sets **one mark for the group**, and allows a per-member adjustment where deserved (section 5.5).

**Teaching assistants work in this same room** with every tool available — running, debugging, commenting, suggesting marks — but everything a TA writes saves as a **draft awaiting a teacher**. The teacher sees the TA's suggested mark and feedback, adopts or edits them, and releases. Students never see anything a teacher hasn't signed off.

Marks stay hidden in draft until the teacher **releases** them — either one student at a time or the whole class at once, so nobody hears their result before their neighbour unfairly.

### 7.4 The gradebook

The class-wide grid: every student × every assignment, with marks, late flags and missing gaps visible in one look. Exportable as a spreadsheet file for whatever mark-administration system the school uses.

---

## 8. The honesty layer (anticheat, light version)

Per your decision: no scanning, no surveillance — just an incorruptible paper trail, plus teacher-controlled sharing. Concretely:

### 8.1 What is always recorded

- Every project and submission **belongs to a named account**. There is no anonymous submission.
- Every submission snapshot carries its **exact date, time, and a fingerprint of the content** — if anyone ever asks "is this really what was handed in?", the answer is provable.
- Every project carries its **growth history** — the checkpoint trail from section 6.3. A teacher viewing a submission can open its **timeline** and see how the work developed over days: steady growth looks like steady growth; a project that materialised fully formed an hour before the deadline looks like exactly that. The system draws no conclusions — it shows the timeline; judgment stays with the teacher.
- Every **share** (when sharing is enabled) is written into a ledger: who shared what, with whom, when. A copy that arrived via sharing permanently shows **"based on work shared by [name]"**.

### 8.2 What is deliberately NOT collected

No similarity scanning between students' work. No paste detection. No typing patterns. No webcam, no screen monitoring, no tracking outside the app. Students should be told plainly what is recorded (the honest trail above) — and the system's privacy page says exactly that in one screen of text.

### 8.3 Sharing controls

- Class-level switch: peer sharing **on or off** for the whole class (off by default).
- Assignment-level: the **individual work flag** overrides sharing off for that assignment regardless of the class setting.
- In pair/group assignments, the shared group project is visible to its members by design; the timeline still records which member made every checkpoint (section 5.5).
- Teacher templates and guides are always shareable downward — that is teaching.

---

## 9. Emails and notifications

Every email the system will ever send, in one table. All of them are short, plain, and about one thing. Nobody is ever emailed for marketing.

| Email | Goes to | When | Default |
|---|---|---|---|
| Confirm your address | New signups | At signup | Always |
| Reset your password | Anyone | On request | Always |
| **A new teacher signed up** | **You (admin)** | Every teacher signup — name, email, time, console link | Always |
| You're invited to [class] | Invited students | Teacher sends invites | Always |
| You're invited to assist [class] | Invited TAs | Teacher invites a TA | Always |
| Submission receipt | Student (every member, for group work) | On every submit/resubmit | On |
| Marks released | Student | Teacher releases marks | On |
| Work returned for changes | Student | Teacher returns work | On |
| Due tomorrow reminder | Students with work unsubmitted | 24h before a due date | On (student can switch off) |
| Reminder from your teacher | Missing students | Teacher presses the reminder button | On |

In-app, a small bell collects the same events plus quiet ones (a student joined your class, an assignment was published). Students and teachers can switch any non-essential notification off in their profile.

**While we build (before any cloud):** the system will send its "emails" to a built-in **pretend inbox** — a screen where you can see every email it *would* have sent, exactly as it would look. Real email delivery gets connected during the cloud step at the end. Nothing about the design changes; only the postman does.

---

## 10. The admin corner

A small console for the site owner. Not a daily tool — a once-a-week glance:

- **People**: every account, searchable; deactivate / reactivate; resend confirmation; trigger a password reset for someone stuck. Deactivating a teacher freezes (not deletes) their classes.
- **The cap**: current account count vs the 200 limit; raise/lower.
- **Classes**: a list of all classes and sizes — visibility, not management (admins don't mark work or read private notes... though an admin can technically see anything, and the privacy page says so honestly).
- **Health**: storage used, email log (what was sent, what bounced), and a simple "is everything running" panel.
- **Data requests**: export everything about one person as a file, or erase a person completely (section 11).

---

## 11. Privacy and data care

Plain statements, which will also appear on the system's own privacy page:

- **What we store:** name, email, scrambled password, class memberships, projects and their history, submissions, marks and feedback, the share ledger, and sign-in timestamps. That is the whole list.
- **What we never collect:** no location, no contacts, no browsing habits, no advertising identifiers, no photos, no birthdates.
- **Who sees what:** teachers see their own classes' work and marks. Students see their own. Guests see nothing of anyone.
- **Right to leave:** any person can be fully exported (a readable file of everything theirs) and fully erased. Erasing a student removes their account and personal details; their submissions in a class record are kept but renamed to "Removed student" — the class's marks history stays intact without keeping the person.
- **Minors:** signup includes a consent step suitable for school-aged users, and the language throughout is written for them. (South Africa's POPIA rules are the bar being aimed at; the plan phase will check the details properly.)
- **Retention:** archived classes and their submissions are kept for a set period (proposal: 3 years) then deleted automatically, so the system never becomes a data museum.

---

## 12. Built lean, on purpose

The promises that keep this cheap to run for 200 people, restated as design rules:

1. **Physics never runs on a server.** Simulations and data analysis run in the browser, on the user's machine — the single biggest reason this system stays small.
2. **The cloud parts sleep when nobody is using them.** At 3 a.m., the system costs almost nothing.
3. **No video hosting, ever.** Videos are embedded from YouTube/Vimeo; the system stores a link, not a film.
4. **Everything uploaded is size-capped** — images, attachments, project files — with clear limits shown at upload time.
5. **The 200-account cap is enforced by the system itself**, not by a promise.
6. **One system, one school.** No multi-school machinery, no "enterprise" anything.

---

## 13. Deliberately not included (so approving it is explicit)

| Not in this version | One-line reason |
|---|---|
| Similarity/plagiarism scanning | You chose the light honesty layer; can be added later without redesign. |
| Typing/paste surveillance | Same. |
| Live view of student screens during class | Heavy, invasive, and not asked for. |
| Class announcement feed / chat / comments | Guides + assignments + email cover communication; a feed invites moderation work. |
| Rubric-based marking | Points + written feedback first; rubrics are a clean later addition. |
| Real-time simultaneous co-editing | Group work uses the baton model (section 5.5) — two cursors in one project at once is a much heavier build for little classroom gain. |
| Parent/guardian portals | Out of scope. |
| Connecting to school systems (Moodle, Google Classroom, timetables) | The spreadsheet export is the bridge for now. |
| Phone apps | The website works on phones for reading, joining, and checking marks; building work is a laptop activity. |
| More than one school on one installation | One site, one community, 200 people. |
| AI marking or AI tutoring | Not asked for; not included. |

Everything in this table is a **later possibility**, not a locked-out impossibility — the design just doesn't pre-build for any of it.

---

## 14. Every screen in the system

The complete inventory — if a screen is not on this list, it does not exist.

**Everyone**

| Screen | What it's for |
|---|---|
| Front page | Try the IDE (guest) · sign in · sign up |
| Sign in / Sign up / Check your email / Reset password | The doors |
| The IDE workspace | The existing editor — blocks, code, 3D, data panel — with (for signed-in users) the sync chip and, inside assignments, the instructions side panel |
| Profile & settings | Name, password, notification switches |
| Notifications panel | The bell |

**Students**

| Screen | What it's for |
|---|---|
| Home | My classes · due soon · recent feedback · my own projects |
| Join a class | Enter a code (or arrive by link/QR/invite) |
| Class page | Assignments list · guides · my marks in this class |
| Assignment page | Instructions · Start/Continue · group choice (when set) · submission status · Submit |
| My marks | Everything marked, per class |

**Teachers**

| Screen | What it's for |
|---|---|
| Home | Class wall · "needs marking" counts |
| New class | Name it, done |
| Class → Assignments | The list, with submission counts |
| Class → People | Roster, invites, code/link/QR panel, co-teachers, TAs |
| Class → Gradebook | The grid · spreadsheet export |
| Class → Settings | Joining rules, sharing rules, archive |
| Assignment editor | Details & dates · instructions editor · starter project · workspace rules & rule sets · pairs/groups · publish |
| Guide editor | Same page editor, standalone |
| Submissions inbox | Who's in, who's late, who's missing · reminders |
| Submission review | The student's work in the full IDE · test copy · marking panel · timeline |

**Admin**

| Screen | What it's for |
|---|---|
| Admin console | People & cap · classes · health · email log · data requests |

Roughly two dozen screens. Each will be simple, because each does one job.

---

## 15. Assumptions I made (please eyeball these)

Defaults chosen where you hadn't specified — all changeable now at zero cost:

1. **Marks are points out of a teacher-chosen total** per assignment (with a "no marks, just complete" option). No percentages-vs-symbols machinery; the spreadsheet export lets the school compute whatever it likes.
2. **Most-recent-edit-wins** when the same project is changed on two machines, with the losing version kept in history.
3. **English only** in this version.
4. **No profile photos** — coloured initials instead. Less storage, less moderation, fewer safety questions.
5. **Teacher approval of joiners is optional per class**, not forced — codes projected in a classroom are the normal path and shouldn't need a second step.
6. **The due-tomorrow reminder is on by default** (students can switch it off).
7. **Storage allowance per person** around 100 projects / a couple of hundred MB — generous for real use, fatal for abuse.
8. **Archived data auto-deletes after ~3 years** (section 11).
9. **The admin account** is created once, during installation — it is not a signup option.
10. **Sequencing**: everything is built and tested **on your machine first** (including the pretend email inbox), and only once you've used it and are happy does the cloud move happen — Google's cloud, sized for 200, with real email delivery connected at that point.
11. **Group size** tops out at a default of 4 (teacher-adjustable per assignment); groups form either by student choice or teacher arrangement, per assignment.
12. **"Standard classwork" is the default rule set** on every new assignment — import, export and template browsing off; editors, debug and advanced blocks on. Submitting is never counted as an export.
13. **Workspace rules bind only inside assignments.** Personal projects and guest use keep the full IDE, always.

---

## 16. What happens after you approve

1. I write the **technical build plan** — the engineering document version of this one (that's where databases, services and folder layouts get named). You approve that too.
2. The repository is **reorganised on this branch** (`feature/classroom-platform`) into a clean, maintainable split: the app people see, and the engine room behind it — exactly as you asked.
3. The system is **built in stages on your machine**, each stage working and testable before the next starts — you'll be able to click through classrooms and marking long before any cloud is involved.
4. **The cloud move is the last step**, and this document's promises about leanness are the yardstick it gets measured against.

Nothing below step 1 starts until you've approved this document.

---

## 17. Appendix — what the repo had already planned

A full sweep of the repository's documentation confirms this platform was envisioned before, in three independent places — and that **no code for any of it exists anywhere** (documentation only; the old `sakai-int` branch contains nothing salvageable). What exists, and how this document relates to it:

### 17.1 Prior plans this document builds on

| Where | What was already planned there |
|---|---|
| Physics_IDE_Technical.md (removed in the Aug 2026 docs cleanup — retrievable from git history) §6.6.6 "Planned Managed Platform" | The closest ancestor: login, teacher/student roles, class context, server-side work history, teacher templates, student submissions, controlled peer sharing with **mandatory name attribution**, and an audit trail specified as *owner, sharer, recipient, timestamps, version identifier* — nearly word-for-word what section 8 of this document specifies. It also recommends PostgreSQL as the database. |
| Physics_IDE_Technical.md §11.3–11.4 | POPIA data-minimisation rules and the academic-integrity metadata spec ("write-once, visible to authorised staff only") — feeds sections 8 and 11 here. |
| [plan.md](../plan.md) Phases D & E | The deferral gates this document now legitimately opens: cloud save and auth were parked behind "a written feature need" — which this document is. Phase E even sketched the exact mechanism section 3.2 uses for importing guest projects into a new account. |
| TECHNICAL_ARCHITECTURE.md (removed in the Aug 2026 docs cleanup — retrievable from git history) §9.2 | Notes that the existing project-bundle export is today's manual "submission" workaround — and that bundle format is the natural payload for section 6.4's submission snapshots. |
| [Physics_IDE_User_Guide.md](Physics_IDE_User_Guide.md) §19 "For Educators" | Documents the current manual workflow (export a file, email it around) that this platform replaces. |

### 17.2 Where this document deliberately overrides older plans

- **Cloud target.** Older docs name three different homes (Supabase, Azure, the ilifu research facility). The current decision is **Google's cloud**, made after the July 2026 Azure costing exercise. The older material stays useful as sizing/cost reference only.
- **Scale.** Older documents sized for 500–10,000 learners. This document's hard cap is **200 accounts**.
- **Anticheat.** The old roadmap proposed "similarity and unusual-timing analytics". Your decision is the **light honesty layer** (section 8); similarity scanning is explicitly in the not-included table.
- **Identity.** Older docs assumed university sign-in via the institution's systems (iKamva/LTI). This document specifies **standalone accounts** with open signup; connecting to school systems stays in the not-included table. The LTI research remains on the shelf for the day that changes.
- **Roles.** Older docs floated an optional teaching-assistant role; after your first review this document includes it (drafts-only TAs, section 2) alongside co-teachers — so on this one point the old plans and the new spec now agree.

### 17.3 Paperwork owed before code lands

[product-contract.md](product-contract.md) forbids servers, accounts, rosters and dashboards for v1 and includes a change protocol: **the contract must be amended, with the trigger written down, before any code that deviates from it lands.** This document is the written trigger; updating the contract is the first task of the build plan. Smaller cleanups for the same reason: "no accounts, no backend" statements in [README.md](../README.md), [DEPLOY.md](../DEPLOY.md), and the in-app Help page will need updating during the build.
