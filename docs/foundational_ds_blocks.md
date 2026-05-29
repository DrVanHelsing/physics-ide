# Foundational Blocks for a Block-Based Data Science IDE

## Purpose of this Document

This document specifies the non-negotiable block categories and individual blocks required to build a block-based programming IDE capable of teaching foundational data science concepts. The IDE uses a Python backend but abstracts all syntax away — students interact exclusively through visual, drag-and-drop blocks.

The goal is not to teach programming. The goal is to teach students how to **think with data**: how to ask questions of a dataset, describe what they find, and communicate conclusions — before a single line of Python is ever written or read.

---

## Design Principles

Before listing individual blocks, it is important to establish the principles that govern what belongs in a foundational IDE and what does not.

**1. Every block must map to a concept, not a command.**
A block is not just a shortcut for typing code. It represents an idea — a question, a comparison, a transformation. The block "Find the mean" should feel like asking *"what is typical in this column?"*, not like calling `df['col'].mean()`.

**2. Output must be immediate and visible.**
Every block must produce visible output when run. No silent side effects. If a student drops a cleaning block, they should see before-and-after row counts. Feedback loops must be tight.

**3. Blocks must be strongly typed.**
A visualisation block should only accept a dataset as input, not a raw number. Type mismatches teach data structure concepts implicitly — when a block refuses a connection, it teaches the student something about what kind of data belongs where.

**4. The question comes before the code.**
Students should be prompted to think — "what are you trying to find out?" — before selecting a block. Where possible, blocks should be organised around *questions* (e.g. "What is typical?", "What changed over time?") rather than *operations* (e.g. "Calculate mean").

**5. Syntax is a reward, not a requirement.**
A "Show generated Python" block should exist at every stage — but it is optional. Students who are ready to peek at the code behind a block can do so. Students who are not should never be blocked.

**6. Undo is non-negotiable.**
Experimentation is the entire pedagogical mechanism. Fear of breaking things kills curiosity. Full undo/redo history must be present.

---

## Block Category Specification

### Category 1 — What is Data?

**Purpose:** To build the foundational mental model that data has structure, type, and meaning. Students must understand that not all data is the same before they can meaningfully work with it.

**Concepts taught:** Variables, data types, tabular structure, the difference between categorical and numerical data, the idea that a dataset is made of rows and columns.

| Block | What it does | Why it matters |
|---|---|---|
| Create variable — number | Stores a single numeric value with a name | Introduces the concept of a named, reusable value |
| Create variable — text | Stores a single text value with a name | Distinguishes text from numbers at the point of creation |
| Create variable — true/false | Stores a boolean value | Introduces binary logic as a data type, not just a condition |
| Create a list | Stores an ordered collection of values | Bridges the gap from single values to collections |
| Create a table | Creates a dataset with named columns and rows | Teaches tabular structure — the core unit of data science |
| Identify data type | Returns the type of any value or column | Teaches students to interrogate their data before assuming |
| Ask "what type is this?" | Prompts the student to predict the type before revealing it | Builds the habit of reasoning about data types actively |
| Compare two values | Evaluates whether two values are equal, greater, or less | Grounds boolean logic in a concrete, visual comparison |
| Load built-in dataset | Loads a pre-cleaned real-world dataset (e.g. penguins, titanic, weather) | Removes file-handling friction; gives students real data immediately |

**Note on the "Ask what type is this?" block:** The distinction between `"5"` (text) and `5` (number) is one of the most persistent conceptual barriers in early data science. This block surfaces that difference before it can cause invisible errors downstream. It is pedagogically more valuable than any cleaning block.

---

### Category 2 — Exploring Data

**Purpose:** To develop the habit of *looking at data before doing anything to it*. This is one of the most important professional instincts in data science, and it must be taught as the default first step — not an afterthought.

**Concepts taught:** Dataset orientation, dimensions, columns as variables, rows as observations, the idea of a sample.

| Block | What it does | Why it matters |
|---|---|---|
| Show table | Displays the full dataset as a formatted table | Makes data tangible and visible |
| Show first N rows | Shows the top N rows of the dataset | Teaches the concept of a representative sample |
| Show last N rows | Shows the bottom N rows of the dataset | Teaches that the end of a dataset may differ from the start |
| Count rows | Returns the total number of observations | Grounds students in dataset size before doing any analysis |
| Count columns | Returns the number of variables | Teaches that a dataset has two dimensions |
| List column names | Returns all variable names | Teaches columns as named, meaningful variables |
| Show one column | Displays all values in a single column | Introduces the idea of isolating a variable |
| Show one cell | Returns the value at a specific (row, column) | Teaches indexing and the coordinate nature of tabular data |
| Count unique values | Returns the number of distinct values in a column | Introduces the concept of cardinality |
| Find the most common value | Returns the mode of a column without naming it as such | Plants the seed for the statistics category |

**Note on exploration as a stage:** The exploration blocks should be presented before any modification blocks in the IDE's block palette. The sequencing of the palette teaches students the sequencing of the process.

---

### Category 3 — Describing Data (Statistics)

**Purpose:** To teach descriptive statistics not as abstract formulas but as concrete answers to concrete questions. "What is typical?" maps to mean and median. "How spread out is the data?" maps to range and standard deviation. The question drives the statistic.

**Concepts taught:** Mean, median, mode, range, minimum, maximum, sum, count, standard deviation (conceptual), and the difference between measures of centre and spread.

| Block | What it does | Why it matters |
|---|---|---|
| Calculate mean | Returns the arithmetic average of a column | Teaches the most common measure of centre |
| Calculate median | Returns the middle value of a column | Teaches resistance to outliers; compare to mean for skew |
| Calculate mode | Returns the most frequent value | Teaches the appropriate measure for categorical data |
| Find minimum | Returns the smallest value in a column | Grounds range in concrete values |
| Find maximum | Returns the largest value in a column | Grounds range in concrete values |
| Calculate range | Returns max minus min | Introduces the simplest measure of spread |
| Calculate sum | Returns the total of a column | Teaches aggregation; relevant for totals and rates |
| Calculate count | Returns the number of non-missing values | Distinguishes total rows from non-missing values |
| Show spread (std deviation) | Returns the standard deviation with a plain-language label | Introduces variability conceptually without the formula |
| Compare two columns | Runs all stats on two columns side-by-side | Enables comparison, which is where real analysis begins |
| Show all stats at once | Runs all descriptive stats on a column or dataset | Provides a summary view; teaches the concept of a data profile |

**Note on standard deviation:** This block should label its output as "how spread out the values are" rather than "standard deviation" in the student-facing output. The formal term should appear in the "Show generated Python" reveal — not before. Students must understand the concept before they can absorb the vocabulary.

---

### Category 4 — Asking Questions (Filter and Sort)

**Purpose:** To teach that data analysis is fundamentally about asking and answering questions. Filtering is not a cleaning operation — it is the mechanism by which a student narrows a dataset to answer a specific question. This framing is deliberate and important.

**Concepts taught:** Boolean conditions, comparison operators, logical AND/OR, sorting, grouping, aggregation per group, missing data as a concept.

| Block | What it does | Why it matters |
|---|---|---|
| Filter rows where (column = value) | Returns only rows meeting an equality condition | Introduces the concept of a boolean filter |
| Filter rows where (column > value) | Returns rows above a threshold | Introduces inequality conditions |
| Filter rows where (column < value) | Returns rows below a threshold | Completes the basic comparison set |
| Combine two filters (AND) | Returns rows meeting both conditions | Introduces logical AND |
| Combine two filters (OR) | Returns rows meeting either condition | Introduces logical OR |
| Sort by column — ascending | Sorts the dataset from smallest to largest | Teaches ordering as a way to reveal structure |
| Sort by column — descending | Sorts the dataset from largest to smallest | Reveals top/bottom patterns; common in real analysis |
| Find rows where value is missing | Returns rows with empty values in a column | Teaches that data incompleteness is normal and must be handled |
| Remove rows where value is missing | Drops rows with empty values | Teaches the trade-off of dropping data |
| Group by column | Splits the dataset into groups by a categorical variable | One of the most powerful and foundational data operations |
| Count per group | Returns the number of rows in each group | Teaches frequency distributions without naming them |
| Average per group | Returns the mean per group | Bridges grouping and statistics; enables comparison |

**Note on the missing value blocks:** Understanding that data is incomplete by nature is one of the most transformative conceptual shifts a student can make. It changes how they read every dataset they will ever encounter. These two blocks — find missing, remove missing — should be introduced together so students see that identifying and handling are separate decisions.

**Note on group-by:** The group-by-and-count block is arguably the single most powerful foundational data operation a student can learn. "How many students in each school?" "How many sales per region?" "How many species per island?" This is the seed from which comparative analysis, aggregated reporting, and eventually hypothesis testing all grow.

---

### Category 5 — Seeing Data (Visualisation)

**Purpose:** To teach that visualisation is not decoration — it is a mode of reasoning. Different chart types answer different questions, and choosing the wrong chart is not just an aesthetic mistake, it is an analytical one. This category must teach chart selection, not just chart creation.

**Concepts taught:** Chart types and their appropriate use cases, the mapping of data variables to visual channels (x-axis, y-axis, colour, size), distribution, trend, relationship, and composition as visual concepts.

| Block | What it does | Why it matters |
|---|---|---|
| Bar chart | Counts or compares values across categories | Teaches comparison of discrete groups |
| Line chart | Shows change across an ordered variable (usually time) | Teaches the concept of trend |
| Scatter plot | Plots two numeric columns against each other | Teaches the concept of relationship and correlation (visually) |
| Histogram | Shows the distribution of a single numeric column | Teaches distribution as a concept |
| Box plot | Shows spread, median, and outliers of a column | Teaches the five-number summary visually |
| Set chart title | Adds a title to the chart | Teaches that charts must be labelled to communicate |
| Set axis labels | Adds labels to x and y axes | Teaches that axes must describe what they represent |
| Change colour | Changes the colour of a chart element | Teaches that colour encodes meaning |
| Annotate a point | Adds a text label to a specific data point | Teaches that charts can highlight findings |
| Ask: "which chart fits this question?" | Prompts the student to choose a chart type before creating it | Teaches chart selection as a deliberate analytical decision |

**Note on the "which chart fits this question?" block:** This is not a chart-creation block. It is a reasoning block. It presents the student with their current dataset and a multiple-choice prompt: "What are you trying to show — a comparison, a trend, a distribution, or a relationship?" The student's answer pre-selects the appropriate chart type. This is the most important visualisation block in the palette because it teaches *why* before *how*.

**Note on omitted chart types:** Pie charts and heatmaps are intentionally excluded from the foundational palette. Pie charts are frequently misused and teach poor visual reasoning habits. Heatmaps require understanding of correlation matrices, which is beyond foundational scope. Both can be introduced at an intermediate level.

---

### Category 6 — Communicating Findings

**Purpose:** To teach that data analysis is not complete when the numbers are computed — it is complete when a conclusion is stated. This category closes the analytical loop and introduces the concept of evidence-based claims.

**Concepts taught:** The structure of a data-backed conclusion, the difference between a finding and an opinion, the relationship between code and output, communicating to an audience.

| Block | What it does | Why it matters |
|---|---|---|
| Write a note / caption | Adds a plain-text annotation to the workspace | Teaches that findings must be labelled and contextualised |
| Print a result | Displays any computed value with a label | Teaches explicit output — nothing should be invisible |
| Compare two results | Places two computed values side-by-side with labels | Teaches that analysis often involves comparison |
| State a conclusion | Presents a fill-in-the-blank conclusion template ("The data shows that...") | Teaches the form of an evidence-based claim |
| Show generated Python | Reveals the Python code that the current block sequence produced | Bridges visual blocks to real code for students who are ready |
| Export table | Saves the current dataset as a CSV file | Teaches that data has a lifecycle beyond the workspace |
| Save chart | Saves the current chart as an image file | Teaches that visualisations are shareable artefacts |

**Note on "Show generated Python":** This is the single most important bridge block in the IDE. It should be available at every stage — not just at the end. A student who has just filtered a dataset and wants to see what that looks like in code should be able to reveal it immediately. The block should show clean, well-commented Python. This is the natural exit ramp from the block-based environment to real data science tooling.

**Note on "State a conclusion":** This block should provide a sentence scaffold — for example: *"The data shows that [group] has a [higher/lower] [statistic] than [other group]."* The scaffold is not a limitation; it is a model. It teaches students that conclusions have a structure, and that structure is what separates analysis from observation.

---

## Summary: Concepts Covered Without Teaching Syntax

The six categories above collectively cover the following foundational data science concepts — none of which require a student to write, read, or understand Python syntax:

| Concept | Covered by |
|---|---|
| Variables and data types | Category 1 |
| Tabular data structure (rows and columns) | Categories 1, 2 |
| Dataset orientation and profiling | Category 2 |
| Measures of centre (mean, median, mode) | Category 3 |
| Measures of spread (range, std deviation) | Category 3 |
| Boolean logic and conditional filtering | Category 4 |
| Missing data and data completeness | Category 4 |
| Grouping and aggregation | Category 4 |
| Distribution and frequency | Categories 3, 4, 5 |
| Chart selection and visual encoding | Category 5 |
| Trend, relationship, composition | Category 5 |
| Evidence-based conclusions | Category 6 |
| The relationship between blocks and code | Category 6 |

---

## What is Deliberately Excluded

The following are common data science topics that are **not** included in the foundational palette, and the reasoning for their exclusion:

**Machine learning (all forms):** Train/test splits, model fitting, prediction, and evaluation require an understanding of generalisation, overfitting, and mathematical optimisation that is not accessible without statistical foundations. These belong at an intermediate or advanced level.

**Data merging and joining:** While merge and join are important operations, they require students to reason about relational structure across multiple tables simultaneously. This is a meaningful conceptual step beyond single-table analysis.

**Feature engineering and encoding:** One-hot encoding, normalisation, and derived columns presuppose an understanding of why models require numeric input — which requires understanding what a model is. Out of scope.

**Advanced statistics (hypothesis testing, correlation coefficients):** These require a foundation in probability and distributions that cannot be built within a block-based foundational IDE. Visualised correlation (scatter plot) is included; r-values are not.

**Regular expressions and text parsing:** String manipulation at this level assumes programming familiarity that contradicts the syntax-free philosophy.

---

## Recommended Block Palette Organisation

Blocks should be organised in the palette in the same order as the categories above. This is not arbitrary — the order of the palette teaches the order of the analytical process. Students who browse the palette top-to-bottom are implicitly learning the data science workflow.

Within each category, blocks should be ordered from most concrete to most abstract. "Show first 5 rows" before "Count unique values". "Find mean" before "Show spread". The beginner reaches for the top of each category; the more advanced student works down.

Each block should display:
- A plain-language label (e.g. "Find the average")
- A one-sentence description on hover (e.g. "Returns the mean of a numeric column")
- The concept it teaches (e.g. "Measure of centre")
- The generated Python, revealed only on explicit request
