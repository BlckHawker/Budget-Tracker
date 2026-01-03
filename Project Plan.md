
## 1. Project Overview

This project aims to build a **personal finance management application** that helps users track money across accounts, enforce spending limits, and allocate funds according to customizable rules.

At its core, the application ensures that every transaction is transparently allocated to a **Category** and ultimately to specific Wishlist Items, making it clear where every dollar is being used. Historical allocation rules are preserved, so changes to budgets do not affect past transactions. Additionally, users have the option to keep track of bills and working hours to be aware of estimated upcoming transaction. 

The system is designed to:

- Provide clear visibility into available funds across multiple accounts.
    
- Enforce budgeting discipline through category and wishlist allocations.
    
- Support long-term financial goals by linking day-to-day spending to user-defined WishlistItems.

## 2. Objective

The primary objective of this project is to create a **personal financial tracking application** that helps users manage their money effectively by enforcing allocation rules across categories and wishlist items.

### Core Objectives

1. **Centralized Transaction Tracking**
    
    - Record all financial transactions across multiple accounts (e.g., Wallet, Bank, CashApp).
        
    - Maintain balances per account and aggregate balances at the category and wishlist item levels.
        
2. **Rule-Based Allocation**
    
    - Enforce budget discipline by automatically splitting deposits across **Categories** according to a `CategoryRuleSet`.
        
    - Further subdivide each Category’s allocation across **WishlistItems** using a `WishlistRuleSet`.
        
    - Ensure that all transactions are ultimately allocated through WishlistItems (no “Category-only” option).
        
3. **Spending Control and Transparency**
    
    - Provide visibility into where money is being allocated at both the Category and WishlistItem level.
        
    - Prevent overspending by enforcing allocations and updating balances consistently across all levels.
        
4. **Historical Accuracy**
    
    - Maintain a history of allocation rules by using effective-dated `CategoryRuleSet`s and `WishlistRuleSet`s.
        
    - Ensure that transactions always use the rules in effect on their transaction date, preserving financial history.
        
5. **Remainder Handling**
    
    - Automatically route rounding differences or incomplete allocations into **Remainder WishlistItems**, guaranteeing that no funds are lost or untracked.

6. **Bill Tracking and Management**

    - Track recurring bills and subscriptions.
        
    - Automatically generate future bill occurrences based on defined schedules while preserving historical accuracy.
        
    - Allow users to handle real-world changes such as skipped, postponed, or adjusted bills without mutating past records.
        

7. **Income Estimation and Pay Tracking**

    - Estimate income based on logged hours worked, pay rates, and job schedules.
        
    - Generate projected and actual paychecks.
        
    - Provide visibility into expected versus received income while preserving historical records.


### Scope & Stretch Goals

- **Single-user only**: This release does not include authentication or user accounts. All data is stored at the database root.

- **Automatic Transaction Detection:** Integrate APIs (if available) for accounts to detect transactions automatically.
## 3.1 Database Schema
### Account

Represents where money is stored. 

**Example Accounts:**
- Wallet (all the cash in my wallet)

- CashApp (money in my CashApp account)

- Bank of America Checking (my BoA checking account)


```json
{
  "_id": ObjectId,
  "name": String,            // must be unique (even against archived)
  "type": String,               // ENUM: "checking" | "savings" | "credit"
  "credit_limit": Number,       // required if type = "credit"
  "payment_account_id": ObjectId, // Defines where money comes from to pay off the credit card. nullable; required if type = "credit"
  "statement_end_date": Date, //The end date of the statement cycle
  "statement_due_date": Date, // The date a credit card payment is due  required if type = "credit"
  "is_archived": Boolean,    // archived accounts cannot have name conflicts
  "description": String, // nullable. Optional note for the account
}
```
### Category
Represents a spending or saving bucket. Categories are global and not tied to a specific account. Balances in a category are the sum of all transactions assigned to it across all accounts.

**Example Categories:**
- Needs

- Splurge

- Emergency

```json
{
  "_id": ObjectId,
  "name": String,        // unique
}
```
### CategoryRuleSet
Represents a set of category percentages that apply starting from a given date.


```json
{
  "_id": ObjectId,
  "effective_date": Date,     // unique across rule sets. Time will always be stored as 12:00AM local time
  "rules": [
    {
      "category_id": ObjectId,  // references Categories
      "percentage": Number       // must sum to 100 across rules
    }
  ]
}

```

### WishlistItem

Represents something you want to fund, tracked under a parent Category. Each item receives allocations when deposits flow into its Category.

- Every Category must always have at least one WishlistItem designated as the **remainder bucket**.

- Remainder bucket items cannot be deleted, since they capture leftover allocations from rounding or incomplete rule percentages.

**Example WishlistItems:**
- Headphones (under "Wants")

- New Chair (under "Wants")

- Emergency Fund Laptop (under "Savings")

```json
{
  "_id": ObjectId,
  "category_id": ObjectId,     // parent Category
  "name": String,              // unique per Category
  "description": String,       // optional notes / purchase links
  "target_amount": Number,     // optional goal
  "is_remainder": Boolean,     // true = remainder bucket (always at least one per Category)
}
```
### WishlistRuleSet
A grouping of rules for how WishlistItems under a Category get allocated. Only one active set per Category at a time.


```json
{
  "_id": ObjectId,
  "category_id": ObjectId,      // parent Category
  "effective_date": Date,       // unique per category. Time will always be stored as 12:00AM UTC
  "rules": [
    {
      "wishlist_item_id": ObjectId, // references WishlistItem
      "percentage": Number          // must sum to 100 across rules
    }
  ]
}

```
### Transaction
Represents a transaction made from an account

```json
{
  "_id": ObjectId,
  "account_id": ObjectId,        // which Account
  "note": String,
  "amount": Number,              // Cannot have a 0 amount transaction
  "pending_date": Date, //Timestamp when the transation was initialized. in UTC 
  "complete_date": Date, //Timestamp when the transaction became comlete. In UTC
 "exempt_from_stat": Boolean,   // if true, this transaction is ignored in income/expense reviews (but still affects Categories & WishlistItems)
  "category_id": ObjectId,       // nullable; if null, split via CategoryRuleSet
  "wishlist_item_id": ObjectId,  // nullable; if null, split via WishlistRuleSet
}
```
- `category_id = null` means “All Categories”
- `wishlist_item_id = null` means “All WishlistItems within the resolved Category”
- Both null means full hierarchical allocation

#### Account-Type-Aware Transaction Logic
##### Depository Accounts (`checking`, `savings`)
- `amount > 0` means income (balance increases)
- `amount < 0` means expense (balance decreases)
#####  Credit Accounts (`credit`)
- `amount > 0` means **charge**
    - Increases credit card balance (more debt)
- `amount < 0` means **payment**
    - Decreases credit card balance (less debt)
### BillOverview
Represents bill information the user has

```json
{
  "_id": ObjectId,
  "name": String,            // unique (even for archived bills)
  "amount": Number,          // The amount of money the bill is
  "category_id": ObjectId,   // parent Category
  "due_date": Date,          //The first due date of the bill (should be in UTC). Future dates will be calculated by the frequency
  "frequency": String,       // ENUM: "weekly" | "monthly" | "yearly"
  "is_archived": Boolean     //if the bill is active and should be shown
}
```

**Example Bill Overview:**
- Phone bill (monthly on the 23rd)
```json
{
  "_id": ObjectId("Overview ID 1"),
  "name": "Phone Bill",
  "amount": 85.00,
  "category_id": ObjectId("Needs Catgory ID"),
  "due_date": "2025-01-23T00:00:00Z",
  "frequency": "monthly",
  "is_archived": false
}
```

- Therapy (weekly on Monday)
```json
{
  "_id": ObjectId("Overview ID 1"),
  "name": "Therapy",
  "amount": 120.00,
  "category_id": ObjectId("Needs Catgory ID"),
  "due_date": "2025-01-06T00:00:00Z",
  "frequency": "weekly",
  "is_archived": false
}
```

- Streaming Subscription (yearly on Dec 5th)
```json
{
  "_id": ObjectId("Overview ID 1"),
  "name": "Streaming Subscription",
  "amount": 129.99,
  "category_id": ObjectId("Splurge Category"),
  "due_date": "2025-12-05T00:00:00Z",
  "frequency": "yearly",
  "is_archived": false
}
```

### BillOccurrence
Represents an occurrence of a bill. A year's worth of these occurrences will be always be available for the user to see.
```json
{
"id": ObjectId,
"bill_overview_id": ObjectId, //the id of the bill this information comes from
"date": Date, //The date the bill is due. Stored in UTC date 
"transaction_id": ObjectId //The id of the tranaction in which this bill was paid.
}
```
- Occurrence generation runs on create, update, and calls of relevant `BillOccurrence` and `Bill Overview`.
**Example Bill Occurrences:**
- A phone bill overview has been created. $85 will be paid every month
```json
{
  "_id": ObjectId("Phone Bill ID"),
  "name": "Phone Bill",
  "amount": 85.00,
  "category_id": ObjectId("Need Category ID"),
  "due_date": "2025-01-23T00:00:00Z",
  "frequency": "monthly",
  "is_archived": false
}
```

- 12 of these Bill occurrences will be created with the only difference being to due date. One for each month of the 1st.
### BillException
- Represents exceptions of bills for that specific occurrence. These are immutable
```json
{
  "_id": ObjectId,
  "bill_occurance_id": ObjectId,
  "date": Date, //The date of the bill that is being affected (should be in UTC).
  "type": string,  // ENUM: "postpone" | "cancel" | "amount_change"
  "new_date": Date, // The next occruance of the bill. Only used if type is "postpone" 
  "new_amount": Number // The amount the bill is for this occurance. Only used if type is "amount_change"
}
```

**Example BillExceptions:**

- Original bill. Pay $50 a month for gym membership
```json
{
  "_id": "BILL_GYM",
  "name": "Gym Membership",
  "amount": 50,
  "category_id": "CAT_NEEDS",
  "due_date": "2025-01-01T00:00:00Z",
  "frequency": "monthly",
  "is_archived": false
}
```


- Postpone. Instead of the bill being paid on Feb 1st, it will be paid the 5th. Occurrences afterwards will be paid the 1st.
```json
{
  "_id": "EXC_1",
  "bill_id": "BILL_GYM",
  "date": "2025-02-01T00:00:00Z",
  "type": "postpone",
  "new_date": "2025-02-05T00:00:00Z"
}
```

- Cancel. The bill will not occur on March 1st. It will continue on April 1st.
```json
{
  "_id": "EXC_2",
  "bill_id": "BILL_GYM",
  "date": "2025-03-01T00:00:00Z",
  "type": "cancel"
}
```

- Amount Change. $55 will be charged on April 1st instead of $50. All occurrences will still be $50
```json
{
  "_id": "EXC_3",
  "bill_id": "BILL_GYM",
  "date": "2025-04-01T00:00:00Z",
  "type": "amount_change",
  "new_amount": 55
}
```

### Job

Represents a source of work income and the pay schedule
```json
{
  "_id": ObjectId,
  "name": String,         // unique name from all other jobs
  "pay_type": String,     // ENUM: "hourly", "per_day"
  "rate": Number,          // hourly/daily rate
  "frequency": String,       // ENUM: "weekly", "biweekly"
  "start_date": Date,        // The start date of the pay period in UTC
  "archived": boolean
}
```
- `rate` must be >0
- `start_date` is immutable
- Jobs are that are archived are immutable
- Jobs can't be deleted
### WorkLog
Represents a work day
```json
{
	"_id": ObjectId,
    "job_id": ObjectId,         // reference to Job
    "start_time": Date,         //UTC timestamp of when clocking in
    "end_time": Date,           //UTC timestamp of when clocking out
    "additional_notes": String, //nullable. Optional notes for job ex specific position like cashier
}
```
- Past WorkLogs that belong to a Paycheck with a `transaction_id` that is not null are immutable.
### Paycheck
Represent the estimated paycheck from a certain job. 
```json
{
  "_id": ObjectId,
  "job_id": ObjectId, // the id of job this payroll is for
  "start_date": Date,        // The start date of the pay period (inclusive),
  "end_date": Date,        // The end date of the pay period (inclusive)
  "gross_pay": Number, // nullable on initalization.The actual gross amount earned this paycheck
  "transaction_id": ObjectId //nullable. The id of this paycheck as a transaction. Net pay can be checked through here

}
```

- Start dates for `weekly` and `biweekly` frequencies will start on the day of the `start_date` in the corresponding `Job`.
	- Ex if the `Job`'s `start_date` is a Friday. The paycheck's `start_date` and `end_date` will also be Fridays
- 3 months worth of Paychecks will be created on the initialization of a `Job` and its respective `PaySchedule`. When 1/2 (or less) of a month worth of Paychecks are left with no `transaction_id`s for that `Job`, and the job is not `archived`, another 3 months worth of Paychecks will be created.
- Past Paychecks are immutable with the exception of the `gross_pay`, and `transaction_id`
- `end_time` must always be after `start_time`
- Paychecks always look at the `start_time` of a `WorkLog` to see which Paycheck it belongs to.
## 4. Functional Requirements
### 4.1 Account Management

- Users can create, update, archive, and unarchive Accounts.
    
- Account names must be **globally unique**, including archived Accounts.
    
- Accounts support the following types:
    
    - `checking`
        
    - `savings`
        
    - `credit`
        
- Archived Accounts:
    
    - Cannot accept new Transactions.
        
    - Preserve all historical Transactions and balances.
        
- New Accounts start with a balance of `0`.
    

#### Credit Account Rules

- Credit Accounts must define:
    
    - `credit_limit > 0`
        
    - `payment_account_id`
        
    - `statement_end_date`
        
- Credit Accounts cannot be created without a valid payment account.
    
- Credit Account reporting must include:
    
    - Current balance (total debt)
        
    - Available credit
        
    - Percentage of credit used
        
    - Whether the balance can be fully paid off from the payment account
### 4.2 Category & Wishlist Structure

#### Categories

- Categories are global and not tied to Accounts.
    
- Category names must be unique.
    
- Category balances are derived from the sum of their WishlistItems.
    
- Categories cannot exist without at least one WishlistItem.
    

#### WishlistItems

- WishlistItems belong to exactly one Category.
    
- WishlistItem names must be unique within their Category.
    
- WishlistItems may define:
    
    - Optional `description`
        
    - Optional `target_amount > 0`
        
- Target amounts:
    
    - Are informational only
        
    - Do not cap or block allocations
        
- WishlistItem balances update automatically based on allocations.
    

#### Remainder WishlistItems

- Every Category must always contain **exactly one remainder WishlistItem**.
    
- Remainder WishlistItems:
    
    - Are created automatically
        
    - Cannot be deleted
        
    - Cannot be renamed
        
    - Are always eligible to receive allocations
        
- Remainder WishlistItems capture:
    
    - Rounding differences
        
    - Incomplete rule splits
        
    - Any unallocated residual funds
### 4.3 RuleSets & Allocation Integrity

#### CategoryRuleSets

- CategoryRuleSets define how income is split across Categories.
    
- Each CategoryRuleSet:
    
    - Has a unique `effective_date`
        
    - Must total exactly **100%**
        
- RuleSets are immutable once active.
    

#### WishlistRuleSets

- WishlistRuleSets define how a Category’s allocation is split among its WishlistItems.
    
- Each Category may have multiple WishlistRuleSets over time.
    
- Only one WishlistRuleSet may be active per Category per date.
    
- Each WishlistRuleSet:
    
    - Has a unique `effective_date` **per Category**
        
    - Must total exactly **100%**
        
    - May include each WishlistItem only once
        
- RuleSets are immutable once active.
    

#### Historical Integrity

- Transactions always use the RuleSets active on their `pending_date`.
    
- Updating or creating RuleSets:
    
    - Applies only to future Transactions
        
    - Never mutates past allocations
        
- Retroactive RuleSets:
    
    - May be created for imported or backdated data
        
    - Apply only to Transactions occurring on or after their `effective_date`
### 4.4 Transaction Management

#### Transaction Creation

- Each Transaction must include:
    
    - `account_id`
        
    - `amount` (non-zero)
        
    - `pending_date`
        
- `complete_date` may be set later.
    
- Transactions linked to archived Accounts are rejected.
#### Account-Type-Aware Logic

##### Depository Accounts (`checking`, `savings`)

- `amount > 0` → income
    
- `amount < 0` → expense
##### Credit Accounts (`credit`)

- `amount > 0` → charge
    
    - Increases credit balance (debt)
        
    - Allocated as an expense
        
- `amount < 0` → payment/income
    
    - Reduces credit balance
        
    - Deducts funds from the payment account
        
    - Does **not** count as income
        
- Credit Transactions without a valid payment account are rejected.
    

#### Statistics & Reporting Flags

- Transactions may be marked `exempt_from_stat`
    
    - They affect Account, Category, and WishlistItem balances
        
    - They are excluded from income/expense analytics
### 4.5 Allocation Rules

#### Allocation Scope

- A Transaction may specify:
    
    - A specific `wishlist_item_id`
        
    - A `category_id` with `wishlist_item_id = null`
        
    - Neither (`category_id = null`, `wishlist_item_id = null`)
        
- Expenses **must** specify a Category or WishlistItem.
    
    - Expenses cannot be distributed via RuleSets.
        
- Every Transaction must resolve to **at least one WishlistItem**.

#### Allocation Behavior

##### Explicit WishlistItem

- 100% of the Transaction amount is allocated to the specified WishlistItem.
    
- Parent Category balance updates automatically.

##### All WishlistItems in a Category
- Amount is split using the active WishlistRuleSet.
    
- Rounding leftovers flow to the Category’s remainder WishlistItem.

##### All Categories

1. Amount is split using the active CategoryRuleSet.
    
2. Each Category allocation is split using its active WishlistRuleSet.
    
3. Rounding leftovers flow to each Category’s remainder WishlistItem.
    

##### Rounding Rules

- All allocations are rounded **down to 2 decimal places**.
    
- Fractional remainders are routed to remainder WishlistItems.
    
- Total allocated value must always equal the original Transaction amount.
### 4.6 Bills

#### BillOverviews

- Users can define recurring Bills.
    
- Bill names must be globally unique, including archived Bills.
    
- Bills:
    
    - Cannot be deleted
        
    - May be archived
        
- Archived Bills:
    
    - Are immutable
        
    - Do not generate new BillOccurrences
        

#### BillOccurrences

- BillOccurrences are generated automatically:
    
    - On Bill creation or update
        
    - At least **1 year into the future**
        
- Occurrences:
    
    - Are immutable once `transaction_id` is assigned
        
    - Cannot be deleted directly
        
- Archiving a BillOverview:
    
    - Deletes all **future unpaid** BillOccurrences
        
    - Preserves all past and paid occurrences
        
    - Deletes exceptions tied to deleted occurrences
        

#### BillExceptions

- BillExceptions:
    
    - Apply to a single BillOccurrence
        
    - Are immutable once created
        
    - Only one exception may exist per occurrence
        
- Supported exception types:
    
    - `postpone` (requires `new_date`)
        
    - `cancel`
        
    - `amount_change` (requires `new_amount > 0`)
        
- Exceptions:
    
    - Do not mutate the underlying BillOverview
        
    - Affect projections only, not historical data
### 4.7 Jobs, WorkLogs & Paychecks

#### Jobs

- Jobs represent income sources.
    
- Job names must be unique.
    
- Jobs:
    
    - Cannot be deleted
        
    - May be archived
        
- Archived Jobs:
    
    - Are immutable
        
    - Do not generate new Paychecks
        
- `start_date` is immutable.
    
- Creating a Job generates **3 months of Paychecks**.
    

#### WorkLogs

- WorkLogs:
    
    - Must have `end_time > start_time`
        
    - Cannot overlap within the same Job
        
- WorkLogs are assigned to Paychecks based on `start_time`.
    
- WorkLogs tied to finalized Paychecks are immutable.
    

#### Paychecks

- Paychecks:
    
    - Align to Job `start_date` and `frequency`
        
    - Are generated in rolling 3-month windows
        
- When ≤ ½ month of unpaid Paychecks remain:
    
    - Generate 3 additional months
        
- Past Paychecks:
    
    - Are immutable except for `gross_pay` and `transaction_id`
        
- Finalizing a Paycheck:
    
    - Locks associated WorkLogs
        
    - Links the Paycheck to a Transaction
## 4.8 Reporting & Reviews

- The system provides balances for:
    
    - Accounts
        
    - Categories
        
    - WishlistItems
        
- Reports include:
    
    - Income vs Expense summaries
        
    - Category-level breakdowns
        
    - WishlistItem funding progress
        
- Transactions marked `exempt_from_stat`:
    
    - Affect balances
        
    - Are excluded from analytics
## 5. Non-Functional Requirements

- **Reliability**
    
    - Allocation logic must always preserve total balances (no money lost in rounding).
        
    - Every transaction must resolve to at least one WishlistItem.
        
- **Performance**
    
    - Allocation calculations for a transaction should complete in under 1 second.
        
    - Reports (balances, histories) should generate in under 3 seconds for up to 10,000 transactions.
        
- **Maintainability**
    
    - The database schema should be normalized to avoid data duplication.
        
    - RuleSet design must make it easy to add Categories/WishlistItems without rewriting past allocations.
        
- **Scalability**
    
    - The system should support thousands of transactions and dozens of Categories without performance degradation.
        
    - Future support for multiple users should be possible with minimal restructuring.

## 6.  Epics

### Epic 1: Set Up MongoDB

| **Name**                         | **Description**                                                         | **User Story**                                                             |
| -------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **1.1 - Provision MongoDB**      | Start a local Docker container or Atlas cluster; create app/admin user. | As a developer, I want a database available so I can persist data.         |
| **1.2 - Connection Test Script** | Write a simple script to insert/read a dummy document.                  | As a developer, I want to verify Mongo works before wiring up the backend. |
#### 1.1 - Provision MongoDB Acceptance Criteria
- [ ]  MongoDB is deployed (Docker or Atlas).
- [ ] Application user created with least-privilege role.
- [ ]  Connection string (`MONGO_URI`) documented in `.env`.
#### 1.2 - Connection Test Script Acceptance Criteria
- [ ]  A script connects to MongoDB using `MONGO_URI`.
- [ ]  Script inserts a dummy doc into a test collection (e.g. `test`).
- [ ]  Script successfully reads the inserted doc.
---
### Epic 2: Set Up FastAPI Backend

|**Name**|**Description**|**User Story**|
|---|---|---|
|**2.1 - Initialize App**|Set up FastAPI with basic folder structure and main entrypoint.|As a developer, I want a backend framework so I can handle API requests.|
|**2.2 - Configure Settings**|Add config management (dotenv or Pydantic BaseSettings).|As a developer, I want environment-based config so I can run locally and in prod.|
|**2.3 - Add Health Route**|Add `/health` endpoint to verify service is up.|As a developer, I want a health check route so I can monitor system uptime.|
#### 2.1 - Initialize App Acceptance Criteria
- [ ]  FastAPI project scaffold created with, `routers/`, `models/`, and `services/` directories.
- [ ]  App runs locally using a script.
#### 2.2 - Configure Settings Acceptance Criteria
- [ ]  `.env` file is supported for environment-specific configuration.
- [ ]  Pydantic `BaseSettings` validates required fields (e.g., `MONGO_URI`).
- [ ]  Missing or invalid environment variables produce clear error messages.
#### 2.3 - Add Health Route Acceptance Criteria
- [ ]  `GET /health` returns `200 OK` with JSON `{ "status": "ok" }`.
- [ ]  Endpoint is accessible via browser, curl, and postman.
---
### Epic 3: Set Up React Frontend

| **Name**                   | **Description**                                               | **User Story**                                                              |
| -------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **3.1 - Initialize React** | Create React project (with Vite or CRA) and folder structure. | As a user, I want a web interface so I can interact with the budgeting app. |
| **3.2 - Configure Router** | Set up client-side routing with React Router.                 | As a user, I want to navigate between pages like Dashboard and Reports.     |
| **3.3 - Connect to API**   | Add basic API service to fetch data from FastAPI backend.     | As a user, I want data from the backend to display in the frontend UI.      |
#### 3.1 - Initialize React Acceptance Criteria
- [ ] React app bootstrapped using Vite with TypeScript support.
- [ ] Project folder structure created (`components/`, `pages/`, `services/`).
- [ ]  Pages scaffolded: Dashboard, Reports, Accounts, Settings.
#### 3.2 - Configure Router Acceptance Criteria
- [ ]  Routing set up using `react-router-dom`.
- [ ]  User can navigate between Dashboard, Reports, Accounts, and Settings without page reload.
- [ ]  Default route points to Dashboard page.
#### 3.3 - Connect to API Acceptance Criteria
- [ ] Create a fetch service  with error handling.
- [ ]  A sample call to `/health` endpoint is made on Dashboard load.
- [ ]  Dashboard displays API connection status (e.g., “Backend Connected”).
---
### Epic 4: Account Management

| **Name**                  | **Description**                                                                         | **User Story**                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **4.1 - Create Accounts** | Users can create accounts like Wallet, CashApp, or Bank.                                | As a user, I want to create accounts so I can track balances across my sources.             |
| **4.2 - Get Accounts**    | Users can get account(s) by id, name, type, payment_account_id, and/or, archived status | As a user, I want view my accounts, and be able to search for them based on filters.        |
| 4.3 - **Update Account**  | Users can update account name, description, and archived status.                        | As a user, I want update certain aspects of my account in order to keep my budget organized |
#### 4.1 - Create Accounts Acceptance Criteria
- [ ] Following information is required for all accounts
	- [ ] id
	- [ ] name
		- [ ] Account names must be unique across both active and archived accounts.
		- [ ] Attempting to create a duplicate name (case-incentive) triggers a validation error.
	- [ ] type
	- [ ] is_archvied
- [ ] Following information should only be for when the type is `credit`
	- [ ] `credit_limit`
	- [ ] `payment_account_id`
	- [ ] `statement_due_date`
- [ ] `description` is optional for all accounts
- [ ] Attempting to create a credit account with no savings or checking accounts created triggers a validation error.
#### 4.2 - Get Accounts Acceptance Criteria
- [ ] All accounts will show the following information
	- [ ] name
	- [ ] type
	- [ ] description
	- [ ] `is_archived`
	- [ ] amount (will be calculated in the front end)
- [ ] Credit accounts will additionally show
	- [ ] `credit_limit
	- [ ] The account the credit account is linked to
	- [ ] `statement_end_date`
	- [ ] `statement_due_date`
	- [ ] percentage of card used (calculated in the front end)
#### 4.3 - Update Accounts Acceptance Criteria
- [ ] Users can change the description of an account
- [ ] Users are able to change the name of an account
	- [ ] The new name must not be the same of the original name
	- [ ] The new name must not be the same of an existing account
- [ ] (Un)Archived
	- [ ]  Archived accounts cannot accept new transactions.
	- [ ]  Past balances and transactions remain visible in reports.
	- [ ]  Archiving does not delete data.
	- [ ]  Archived accounts can be unarchived at any time.
	- [ ]  Once unarchived, the account can accept new transactions.
- [ ] No other properties of an account can be changed
---
### Epic 5: Category
| **Name**                           | **Description**                                                                                                 | **User Story**                                                                                                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **5.1 - Create Categories**        | Users can define global categories (Needs, Splurge, Emergency).                                                 | As a user, I want to create categories so I can budget my spending.                                                                                                                |
| 5.2 - **Get Categories**           | Users can get categories by id, name, type, payment_account_id, and/or, archived status                         | As a user, I want to view my categories, and filter by various options.                                                                                                            |
| 5.3 - **Create Category Rule Set** | User can create rule sets that will tell where money from income will go                                        | As a user, I want to create Category Rule Sets that define how incoming money is split across categories, so my income is automatically allocated according to my budgeting rules. |
| **5.4 - Get Category Rule Sets**   | Users can retrieve category rule sets by id or effective date, or determine which rule applies to a given date. | As a user, I want to view category rule sets so I understand how my income is being allocated over time.                                                                           |
#### 5.1 Create Categories Acceptance Criteria
- [ ]  Category names (case-insensitive) must be unique from one another.
#### 5.2 Get Categories Acceptance Criteria
- [ ] Users are able to filter categories by combination of the following
	- [ ] category id
	- [ ] name (exact or fully). Will always be case-insensitive
	- [ ] type
	- [ ] Payment Account (if account is credit card)
	- [ ] archived or not
#### 5.3 Create Category Rule Set Acceptance Criteria
- [ ] The sum of the percentage of a rule set must equal 100
- [ ] Can't have duplicate rules with the same `category_id`
- [ ] When choosing the effective date, it must not conflict with existing rule sets
	- [ ] The date of the new rule set can't be between the date of existing rule sets
#### 5.4 Get Category Rule Set Acceptance Criteria
- [ ] Get rule sets by
	- [ ] id
	- [ ] effective date
	- [ ] whichever rule set applies to a parametrized date
---
### Epic 6: Wishlist Item

| **Name**                                                        | **Description**                                                                                    | **User Story**                                                                                      |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **6.1 - Add WishlistItems**                                     | Users can add items under Categories for detailed allocations.                                     | As a user, I want to add wishlist items so I can track savings for specific goals.                  |
| **6.2 - Get WishlistItems**                                     | Users can retrieve WishlistItems and filter them by name, target amount, and remainder status.     | As a user, I want to view and search my wishlist items so I can track my savings goals.             |
| **6.3 - Update WishlistItems**                                  | Users can update mutable properties of a WishlistItem such as name, description, or target amount. | As a user, I want to update wishlist items so they stay accurate as my goals change.                |
| **6.4 - Automatic Creation Wishlist Item on Category Creation** | System automatically creates a remainder WishlistItem when a new Category is created.              | As a user, I want leftover money to always be captured so my allocations remain accurate.           |
| 6.5 - Create WishlistRuleSet                                    | Users define how Category funds are split across WishlistItems over time.                          | As a user, I want to control how money flows into specific wishlist goals.                          |
| 6.6 - Get WishlistRuleSet                                       | Users can retrieve Wishlist rule sets by id, effective date, or applicable date.                   | As a user, I want to see which wishlist rules are active so I understand how funds are distributed. |
#### 6.1 - Add WishlistItems Acceptance Criteria
- [ ]  WishlistItem names (case-insensitive) must be unique within their Category.
- [ ]  WishlistItems may include a description and optional target amount.
- [ ] Any WishlistItem created by the user will always have `is_remainder` as false
#### 6.2 - Get WishlistItems Acceptance Criteria
- [ ] Users are allowed to get WishlistItems and its information
- [ ] Users can filter to find specific WishlistItems by:
	- [ ] WishlistItem id
	- [ ] WishlistItem name (exact/fuzzy) (case-insensitive)
	- [ ] Target amount
		- [ ] lack of one
		- [ ] less than parametrized amount
		- [ ] equal to parametrized amount
		- [ ] greater than parametrized amount
	- [ ] `is_remainder`
- [ ] Users can see progress to `target_amount`. Reports show percentage completion toward target. The amounts are calculated in the front end
#### 6.3 - Update WishlistItems Acceptance Criteria
- [ ] The following can be updated in a WishlistItem
	- [ ] Name (must not be the same as another WishlistItem, case-insensitive)
	- [ ] Description
	- [ ] Target amount (can also remove this)
- [ ] The Remainder WishlistItem from each Category is immutable
#### 6.4 - Automatic Creation Wishlist Item on Category Creation Acceptance Criteria
- [ ] When a new category is created, a Wishlist item is automatically created 
	- [ ] `is_remainder` is always true
	- [ ] The name is always `Other`
	- [ ] There will never be a `target_amount`
- [ ] Remainder WishlistItems cannot be deleted or renamed.
- [ ] All rounding leftovers or incomplete splits flow here.
#### 6.5 Create WishlistRuleSet Acceptance Criteria
- [ ] Creation of a WishlistRuleSet must include the following
	- [ ] category id of the parent rule set
	- [ ] The date the rule will start being applied
		- [ ] it must not conflict with existing rule sets. The date of the new rule set can't be between the date of existing rule sets
	- [ ] Rules
		- [ ] Each Wishlist item must share the same category id of the Wishlist Rule Set
		- [ ] The sum of the percentage of all of the Wishlist items must be equal or less than 100
		- [ ] The remainder Wishlist item cannot be added in the Wishlist Rule Set
#### 6.6 Get WishlistRuleSet Acceptance Criteria
- [ ] Get rule sets by
	- [ ] id
	- [ ] effective date
	- [ ] whichever rule set applies to a parametrized date
---
### Epic 7: Transaction Management

| **Name**                           | **Description**                                                                                        | **User Story**                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **7.1 - Add Transactions**         | Users can add income or expense transactions tied to accounts.                                         | As a user, I want to record income/expenses so I can track my financial activity.            |
| **7.2 - Get Transactions**         | Users can retrieve transactions and filter them by account, amount, dates, category, or wishlist item. | As a user, I want to search my transactions so I can find specific financial activity.       |
| **7.3 - Update Transactions**      | Users can update allowed transaction fields while preserving data integrity.                           | As a user, I want to fix transaction details so my records remain accurate.                  |
| **7.4 - Allocate to Category**     | Transactions are allocated to Categories automatically or explicitly based on user input.              | As a user, I want my transactions allocated correctly so my category balances stay accurate. |
| **7.5 - Allocate to WishlistItem** | Transactions are allocated to WishlistItems automatically or explicitly based on user input.           | As a user, I want transactions assigned to wishlist goals so progress is tracked correctly.  |
#### 7.1 - Add Transactions Acceptance Criteria
- [ ] Must have the following properties on creation
	- [ ] id
	- [ ] the `account_id` this transaction is being taken from
	- [ ] the `amount` of the transaction
		- [ ]  if savings/checking
			- [ ] amount > 0 is income
			- [ ] amount < 0 is expense`
		- [ ] if credit
			- [ ] amount < 0 is income/payment of card
			- [ ] amount > 0 is expense`
		- [ ] Amount is never 0 
	- [ ] `pending_date`
	- [ ] `exempt_from_stat`
- [ ] Following properties optional
	- [ ] note
	- [ ] `completed_date`
		- [ ] if given, this cannot be before `pending_daate`
	- [ ] `category_id`
	- [ ] `wishlist_item_id`
		- [ ] if given, `category_id` cannot be null, and `wishlist_item_id` must have the same `category_id` of this transaction
#### 7.2 - Get Transactions Acceptance Criteria
- [ ] Get all information of transaction(s)
- [ ] Search for transaction by combination of the following:
	- [ ] transaction id
	- [ ] account id
	- [ ] note (exact/fuzzy) case insensitive
	- [ ] amount
		- [ ] exactly
		- [ ] less than
		- [ ] greater than
	- [ ] `pending_date`
		- [ ] none
		- [ ] before
		- [ ] on
		- [ ] after
	- [ ] `complete_date`
		- [ ] none
		- [ ] before
		- [ ] on
		- [ ] after
	- [ ] `exempt_from_stat`
	- [ ] `category_id`
		- [ ] none
		- [ ] exact id
	- [ ] `wishlist_item_id`
		- [ ] none
		- [ ] exact id
	- [ ] `wishlist_ruleset_id`
		- [ ] none
		- [ ] exact id
#### 7.3 - Update Transactions Acceptance Criteria
- [ ] The following can be updated in a transaction
	- [ ] account id
		- [ ] new account can't be the same as old one
	- [ ] note
	- [ ] amount
		- [ ] can't be 0
	- [ ] `pending_date`
		- [ ] can't be after `complete_date` if `complete_date` is not null
	- [ ] `complete_date`
		- [ ] can't be before `pending_date` if `pending_date` is not null
	- [ ] `exempt_from_stat`
	- [ ] `category_id`
		- [ ] can't conflict with `wishlist_item_id` if `wishlist_item_id` is not null
	- [ ] `wishlist_item_id`
		- [ ] can't conflict with `category_id`
#### 7.4 - Allocate to Category Acceptance Criteria
- [ ] If `category_id` is null, front end will split the transaction amount by the effective rule set
- [ ] If `category_id` is not null, front end will send the full transaction amount to the specified category
#### 7.5 - Allocate to WishlistItem Acceptance Criteria
- [ ] If `wishlist_item_id` is null, front end will split the transaction amount by the effective rule set
- [ ] If `wishlist_item_id` is not null, front end will send the full transaction amount to the specified wish list item
---

### Epic 8.1: Reporting & Balances

| **Name**                             | **Description**                                                         | **User Story**                                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **8.1 - Account Balances & Reviews** | Users can view balances across accounts and see income/expense reviews. | As a user, I want to see account balances and a clear breakdown of income vs. expense so I understand my financial flow. |
| **8.2 - Category Balances**          | Users can view balances across Categories.                              | As a user, I want to see Category totals so I know how much is left in each budget.                                      |
| **8.3 - WishlistItem Balances**      | Users can view balances and target progress per WishlistItem.           | As a user, I want to see Wishlist progress so I know how close I am to my goals.                                         |
| **8.4 - Transaction History**        | Users can view past transactions with allocation breakdowns.            | As a user, I want to review past income/spending so I can understand my history.                                         |

#### 8.1 - Account Balances & Reviews Acceptance Criteria
- [ ]  Reports show balances for both active and archived accounts.
	- [ ] Can be filtered to show both or either
- [ ]  Reviews include **Income-to-Expense Ratio** in the format: _Income: $X (Y%), Expense: $Z (W%)_.
- [ ]  Reviews exclude transactions where `exempt_from_stat = true`.
#### 8.2 - Category Balances Acceptance Criteria
- [ ]  Reports show balances per Category, aggregated from its WishlistItems.
- [ ]  Expense breakdowns (percentages of total expenses) exclude exempt transactions. 
#### 8.3 - WishlistItem Balances Acceptance Criteria
- [ ]  Reports show balances per WishlistItem.
- [ ]  Progress toward `target_amount` is displayed (%).
#### 8.4 - Transaction History Acceptance Criteria
- [ ]  Reports show all past transactions, with allocations resolved via linked RuleSets.
- [ ]  Must generate within **3s** for up to 10,000 transactions.
---

### Epic 9: Bills

| **Name**                            | **Description**                                                                                                                      | **User Story**                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **9.1 - Add Bill Overview**         | Users can define recurring bills with amount, category, and frequency.                                                               | As a user, I want to add my bills so I can track upcoming obligations.                                    |
| **9.2 - Get Bill Overview**         | Users can view active and archived bill definitions.                                                                                 | As a user, I want to see my bills so I know what recurring payments exist.                                |
| **9.3 - Update Bill Overview**      | Users can update bill metadata or archive bills.                                                                                     | As a user, I want to update my bills so my budget stays accurate.                                         |
| **9.4 - Generate Bill Occurrences** | System auto-generates future bill occurrences based on frequency.                                                                    | As a user, I want bill occurrences generated so I can see upcoming payments.                              |
| **9.5 - Get Bill Occurrences**      | Users can view upcoming and historical bill occurrences.                                                                             | As a user, I want to see individual bill occurrences so I can track due dates.                            |
| **9.6 - Delete Bill Occurrences**   | Archiving Bill Overviews should delete future BillOccurrences. But the user should not be able to delete a  BillOccurrence directly. | As a user, when I archive a bill, I want future bill occurrences to be deleted, so my budget is accurate. |
| **9.7 - Add Bill Exception**        | Users can modify or cancel a specific bill occurrence.                                                                               | As a user, I want to adjust a bill occurrence so I can handle real-life changes.                          |
| **9.8 - Get Bill Exceptions**       | Users can view exceptions applied to bill occurrences.                                                                               | As a user, I want to see bill exceptions so I understand why a bill changed.                              |
#### 9.1 - Add Bill Overview Acceptance Criteria
- [ ]  `name` must be globally unique (including archived bills).
- [ ]  `amount` must be greater than `0`.
- [ ]  `due_date` will stored as UTC. But will be the same regardless of the time zone.
- [ ]  `frequency` must be one of: `weekly`, `monthly`, `yearly`.
	- [ ]  Creating a `BillOverview` triggers generation of future `BillOccurrences`.
#### 9.2 - Get Bill Overview Acceptance Criteria
- [ ]  Users can view active bills by default.
- [ ]  Archived bills are hidden unless explicitly requested.
#### 9.3 - Update Bill Overview Acceptance Criteria
- [ ]  Updating `amount`, `category_id`, and/or `frequency`only affects future `BillOccurances`.
- [ ]   Updating `due_date` updates recalculate future occurrences. (Only bill occurrences after the date of the update)
- [ ]  Archived `BillOverviews` are immutable.
- [ ]  Bills cannot be deleted, only archived.
#### 9.4 - Generate Bill Occurrences Acceptance Criteria
- [ ]  At least **1 year** of future BillOccurrences must always exist.
- [ ]  Occurrences are generated strictly from `due_date` + `frequency`.
- [ ]  Generation skips archived bills.
- [ ]  Occurrences are immutable once their `transaction_id` is set.
#### 9.5 - Get Bill Occurrences Acceptance Criteria
- [ ]  Users can view upcoming and historical occurrences.
- [ ]  Occurrence dates reflect applied BillExceptions.
- [ ]  Paid occurrences expose `transaction_id`.
#### 9.6 - Delete Bill Occurrences Acceptance Criteria
- [ ] Users **cannot delete** a `BillOccurrence` directly.
- [ ] When a BillOverview is archived
	- [ ] all **future** BillOccurrences (where `date > now`) are deleted
	- [ ] BillOccurrences with a non-null `transaction_id` **must never be deleted**, regardless of bill status
	- [ ] All **past** BillOccurrences remain intact.
- [ ] BillExceptions associated with deleted BillOccurrences are also deleted.
- [ ] Archived BillOverviews cannot generate new BillOccurrences.
#### 9.7 - Add Bill Exception Acceptance Criteria
- [ ]  Exceptions are immutable once created.
- [ ]  Only one exception may exist per bill occurrence.
- [ ]  `postpone` requires `new_date`.
	- [ ] If the date is the same, warn the user
- [ ]  `amount_change` requires `new_amount > 0`.
	- [ ] If the amount is the same, warn the user
- [ ]  `cancel` removes the occurrence from projections but preserves history.
#### 9.8 - Get Bill Exceptions Acceptance Criteria
- [ ]  Users can view exceptions per bill or per occurrence.
- [ ]  Exception type and affected date must be clearly displayed.
- [ ]  Exceptions do not mutate the underlying BillOverview.
- [ ] Users can see if they are on track for a bill based based on the category
	- [ ] A progress bar will show stating their progress
	- [ ] A triangle will appear somewhere on the progress bar representing what the estimated progress of the bill should be based on the current date
### Epic 10: Jobs and Estimating Paychecks

| **Name**                      | **Description**                                     | **User Story**                                                       |
| ----------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| **10.1 - Add Job**            | Users can define jobs with pay schedules and rates. | As a user, I want to add my job so I can track my income.            |
| **10.2 - Get Job**            | Users can view active and archived jobs.            | As a user, I want to see my jobs so I know my income sources.        |
| **10.3 - Update Job**         | Users can archive jobs or update mutable fields.    | As a user, I want to update job info so my estimates stay accurate.  |
| **10.4 - Add Work Log**       | Users can log worked time for a job.                | As a user, I want to log my work so my pay is estimated correctly.   |
| **10.5 - Get Work Log**       | Users can view logged work entries.                 | As a user, I want to see my work logs so I can verify my hours.      |
| **10.6 - Update Work Log**    | Users can edit unfinalized work logs.               | As a user, I want to fix work logs so mistakes don’t affect pay.     |
| **10.7 - Generate Paychecks** | System generates estimated paychecks automatically. | As a user, I want paychecks generated so I can plan around income.   |
| **10.8 - Get Paycheck**       | Users can view estimated and finalized paychecks.   | As a user, I want to see my paychecks so I can plan my budget.       |
| **10.9 - Update Paycheck**    | Users can finalize paychecks with actual amounts.   | As a user, I want to finalize paychecks so my records match reality. |
#### 10.1 - Add Job Acceptance Criteria
- [ ]  `name` must be unique.
- [ ]  `rate` must be greater than `0`.
- [ ] `start_date` must be immutable after creation.
#### 10.2 - Get Job Acceptance Criteria
- [ ]  Active jobs are shown by default.
- [ ]  Archived jobs are hidden unless explicitly requested.
- [ ]  Archived jobs are read-only.
#### 10.3 - Update Job Acceptance Criteria
- [ ]  Only mutable fields may be updated.
- [ ]  Archiving a job stops paycheck generation.
- [ ]  Jobs cannot be deleted.
#### 10.4 - Add Work Log Acceptance Criteria
- [ ]  `end_time` must be after `start_time`.
- [ ]  WorkLogs are assigned to Paychecks based on `start_time`.
- [ ]  WorkLogs cannot overlap within the same job.
#### 10.5 - Get Work Log Acceptance Criteria
- [ ]  Users can view WorkLogs by job and date range.
- [ ]  Logs reflect UTC times with local display conversion.
#### 10.6 - Update Work Log Acceptance Criteria
- [ ]  WorkLogs tied to a Paycheck with `transaction_id != null` are immutable.
- [ ]  Editable logs automatically recalculate affected Paychecks.
#### 10.7 - Generate Paychecks Acceptance Criteria
- [ ] Creating a job generates 3 months of Paychecks.
- [ ]  Paychecks align to Job `start_date` and `frequency`.
- [ ]  When ≤ ½ month of unpaid Paychecks remain, generate 3 more months.
- [ ]  Archived jobs do not generate new Paychecks.
#### 10.8 - Get Paycheck Acceptance Criteria
- [ ]  Users can view estimated and finalized Paychecks.
- [ ]  Gross pay reflects logged WorkLogs.
- [ ]  Paychecks show linked transaction when paid.
- [ ] Users can filter seeing paychecks by the following
	- [ ] job_id
	- [ ] start date
		- [ ] exactly
		- [ ] before
		- [ ] after
	- [ ] end date
		- [ ] exactly
		- [ ] before
		- [ ] after
	- [ ] gross pay
		- [ ] exactly
		- [ ] less than
		- [ ] more than
	- [ ] has or does not have a `transaction id`
#### 10.9 - Update Paycheck Acceptance Criteria
- [ ]  Only `gross_pay` and `transaction_id` may be updated.
- [ ]  Updating a Paycheck makes associated immutable WorkLogs.
---
### Epic 11: Data Export

| **Name**                    | **Description**          | **User Story**                                                              |
| --------------------------- | ------------------------ | --------------------------------------------------------------------------- |
| **11.1 - Export JSON Data** | Export the full database | As a user, I want to export my data to JSON so I can back it up or migrate. |

#### 11.1 - Export JSON Data Acceptance Criteria
- [ ]  Includes effective dates and historical references.
- [ ]  Export can be fully restored via JSON import without loss.

---
### Epic 12: Data Import

| **Name**                    | **Description**         | **User Story**                                             |
| --------------------------- | ----------------------- | ---------------------------------------------------------- |
| **12.1 - Import JSON Data** | Import full system data | As a user, I want to restore or migrate my data from JSON. |

#### 12.1 - Import JSON Data Acceptance Criteria
- [ ]  Accepts `.json` file matching export schema.
- [ ]  Validates JSON schema before import.
- [ ]  Preserves effective dates on RuleSets.
- [ ]  Import summary displayed (counts of Accounts, Categories, Transactions imported).
---
