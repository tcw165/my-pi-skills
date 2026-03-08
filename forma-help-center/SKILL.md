---
name: forma-help-center
description: Navigate and extract information from the Forma Help Center (support.joinforma.com). Includes searching articles, browsing categories, and extracting detailed eligibility and benefits information.
---

# Forma Help Center

The Forma Help Center (https://support.joinforma.com/hc/en-us/) is a comprehensive knowledge base with detailed information about benefits, accounts, claims, and Forma products. It's more detailed than the in-app eligibility modals.

## Key Concepts

### When to Use Help Center vs. Dashboard

**Use the Help Center when you need:**
- Detailed explanations of benefit categories
- Best practices for account usage
- Claims procedures and requirements
- Year-end and post-termination guidance
- HSA specific information
- Forma Card usage details

**Use the Dashboard Modal when you need:**
- Quick reference of eligible categories
- Current account balance information
- Account overview

## Help Center Structure

### Main URL
```
https://support.joinforma.com/hc/en-us/
```

### Main Categories
1. **Getting Started** - Onboarding and initial setup
2. **Claims Deep Dive: What to Know** - Claims submission and reimbursement
3. **Using the Forma Store** - Marketplace and product information
4. **Using your Forma Card** - Card usage, spending, transactions
5. **Using your HSA** - Health Savings Account specific guidance
6. **End of Year and Post-Termination Guidance** - Year-end procedures and COBRA

### Promoted/Featured Articles
- Best Practices for Employer-Sponsored Post-Tax Accounts
- Best Practices for Pre-tax Accounts (FSA, HSA, etc.)

## Navigation

### Browsing Categories

Each category contains multiple articles organized by topic.

**Example: Getting Started typically includes:**
- Welcome/onboarding articles
- Account setup
- Benefit types overview
- Getting your Forma Card

**Example: Claims Deep Dive includes:**
- What qualifies for reimbursement
- How to submit claims
- Documentation requirements
- Claim timelines and status
- Rejection reasons and fixes

### Search Functionality

The help center has a search box at the top that searches across all articles.

**Common search queries:**
- "FSA eligible" - Find FSA eligibility information
- "HSA limits" - Find HSA contribution and spending limits
- "claims" - Find claims-related articles
- "dependent care" - Find dependent care account info
- "letter of medical necessity" - Find requirements for items needing medical necessity

**Search implementation:**
```bash
# Navigate to help center
browser-nav.js https://support.joinforma.com/hc/en-us/

# Wait for page load
sleep 2

# Type search query
browser-eval.js '(function() {
  const searchBox = document.querySelector("input[placeholder*=\"Search\"]") || 
                    document.querySelector("input[class*=\"search\"]");
  
  if (searchBox) {
    searchBox.focus();
    searchBox.value = "FSA eligible";
    
    // Trigger search event
    const event = new Event("input", { bubbles: true });
    searchBox.dispatchEvent(event);
    
    return "Searched for: FSA eligible";
  }
  return "Search box not found";
})()' 

sleep 2

# Take screenshot to see results
browser-screenshot.js

# Extract search results
browser-eval.js '(function() {
  // Get all search result links
  const results = Array.from(document.querySelectorAll("a")).filter(a => {
    return a.href.includes("/articles/") && a.textContent.trim().length > 10;
  }).map(a => ({
    title: a.textContent.trim(),
    href: a.href
  }));
  
  return results.slice(0, 10);
})()' 
```

## Article Content Extraction

### Article Structure

Forma help articles typically have:
- **Title** - Article heading
- **Breadcrumb** - Navigation path (Category > Subcategory)
- **Body content** - Main article text with sections
- **Related articles** - Links to related topics
- **Search** - Ability to search within help center

### Extracting Article Text

```bash
# Navigate to a specific article
browser-nav.js "https://support.joinforma.com/hc/en-us/articles/ARTICLE_ID"

sleep 2

# Extract article content
browser-eval.js '(function() {
  // Get the main article content
  const article = document.querySelector("article") || 
                  document.querySelector("[role=\"main\"]") ||
                  document.querySelector(".article-content");
  
  if (article) {
    return {
      title: document.querySelector("h1")?.textContent || "No title",
      content: article.innerText,
      html: article.innerHTML.slice(0, 5000)
    };
  }
  
  return "Article not found";
})()' 
```

### Extract All Article Links from Category

```bash
# Navigate to a category (e.g., Getting Started)
browser-nav.js https://support.joinforma.com/hc/en-us/sections/SECTION_ID

sleep 2

# Get all article links in this category
browser-eval.js '(function() {
  const articles = Array.from(document.querySelectorAll("a")).filter(a => {
    return a.href.includes("/articles/") && 
           a.textContent.trim().length > 5;
  }).map(a => ({
    title: a.textContent.trim(),
    href: a.href
  }));
  
  return articles;
})()' 
```

## Common Article URLs and Topics

### Getting Started
- Account setup and activation
- Understanding your benefits
- Navigating the Forma app

### Using your Forma Card
- Adding your card
- Making purchases
- Real-time reimbursement
- Transaction history
- Troubleshooting card issues

### Claims Deep Dive
- What are eligible expenses
- How to submit a claim
- Documentation requirements (receipts, invoices)
- Letter of Medical Necessity (LMN) requirements
- Claim status and tracking
- Rejected claims

### Using your HSA
- HSA limits and contribution rules
- Qualified medical expenses for HSA
- Investment options
- Rollover and carryover rules

### End of Year and Post-Termination
- Year-end account deadlines
- Carryover vs. use-it-or-lose-it rules
- COBRA continuation
- Account access after termination

## FSA Eligibility Information in Help Center

The help center has detailed articles about FSA eligible expenses that go beyond the dashboard modal.

**Look for articles titled:**
- "What expenses are eligible for my FSA?"
- "FSA eligible items and services"
- "Items that require a Letter of Medical Necessity"
- "Dependent care FSA eligible expenses"

**These articles typically include:**
- Comprehensive list of eligible categories
- Examples of eligible items
- Common ineligible items
- Items requiring Letter of Medical Necessity
- State-specific rules
- IRS guidance references

## Automation Workflows

### Workflow 1: Search for Specific Information

```bash
# Start browser
browser-start.js &
sleep 3

# Navigate to help center
browser-nav.js https://support.joinforma.com/hc/en-us/
sleep 2

# Search for "HSA eligible"
browser-eval.js '(function() {
  const searchBox = document.querySelector("input[placeholder*=\"Search\"]");
  if (searchBox) {
    searchBox.focus();
    searchBox.value = "HSA eligible";
    searchBox.dispatchEvent(new Event("input", { bubbles: true }));
    return "Searching...";
  }
})()' 

sleep 3

# Take screenshot to see results
browser-screenshot.js

# Extract top 5 results
browser-eval.js '(function() {
  return Array.from(document.querySelectorAll("a"))
    .filter(a => a.href.includes("/articles/"))
    .slice(0, 5)
    .map(a => ({ title: a.textContent.trim(), href: a.href }));
})()' 
```

### Workflow 2: Navigate Category and Extract All Articles

```bash
# Go to Claims Deep Dive category
browser-nav.js https://support.joinforma.com/hc/en-us/

sleep 2

# Click "Claims Deep Dive" category
browser-eval.js '(function() {
  const links = Array.from(document.querySelectorAll("a"));
  const claimsLink = links.find(a => a.textContent.includes("Claims Deep Dive"));
  if (claimsLink) {
    claimsLink.click();
    return "Clicked Claims Deep Dive";
  }
})()' 

sleep 2

# Extract all article links in this category
browser-eval.js '(function() {
  const articles = Array.from(document.querySelectorAll("a"))
    .filter(a => a.href.includes("/articles/"))
    .map(a => ({
      title: a.textContent.trim(),
      url: a.href
    }));
  return articles;
})()' 
```

### Workflow 3: Extract Detailed Article Content

```bash
# Navigate directly to an article (example URL)
browser-nav.js "https://support.joinforma.com/hc/en-us/articles/360052570294"

sleep 2

# Extract full article content
browser-eval.js '(function() {
  const title = document.querySelector("h1")?.textContent;
  const article = document.querySelector("article") || document.querySelector("[role=\"main\"]");
  
  if (article) {
    const sections = Array.from(article.querySelectorAll("h2, h3")).map(heading => ({
      level: heading.tagName,
      title: heading.textContent.trim(),
      content: heading.nextElementSibling?.innerText || ""
    }));
    
    return {
      title: title,
      fullText: article.innerText,
      sections: sections
    };
  }
})()' 
```

## Tips & Best Practices

### Search Optimization

**Effective search strategies:**
- Search for specific category names: "FSA", "HSA", "Dependent Care"
- Search for specific needs: "eligible", "limits", "claims", "letter of medical necessity"
- Search for procedures: "submit claim", "add card", "year end"
- Combine terms: "FSA eligible expenses"

**Poor searches:**
- Too generic: "help", "information"
- Typos: "reimburement" instead of "reimbursement"
- Incomplete terms: "medi" instead of "medical"

### Extracting Structured Data

When articles contain lists or tables, extract them programmatically:

```bash
browser-eval.js '(function() {
  // Extract all list items from article
  const article = document.querySelector("article");
  const items = Array.from(article.querySelectorAll("li")).map(li => ({
    text: li.textContent.trim(),
    isNested: li.parentElement.tagName === "UL" || li.parentElement.tagName === "OL"
  }));
  
  // Extract all tables
  const tables = Array.from(article.querySelectorAll("table")).map(table => ({
    headers: Array.from(table.querySelectorAll("th")).map(th => th.textContent.trim()),
    rows: Array.from(table.querySelectorAll("tr")).map(tr => 
      Array.from(tr.querySelectorAll("td")).map(td => td.textContent.trim())
    )
  }));
  
  return { items, tables };
})()' 
```

### Handling Dynamic Content

Some articles may load content dynamically. Wait longer before extracting:

```bash
browser-nav.js "ARTICLE_URL"
sleep 3  # Wait for JavaScript to load

# Then extract content
browser-eval.js '...'
```

## Integration with Other Skills

- **browser-tools**: Core navigation and content extraction
- **forma-website-browsing**: Complement with dashboard information
- **brave-search**: Additional web searches for Forma policy details
- **vscode**: Compare information between multiple articles

## Troubleshooting

### Issue: Search results don't appear
- Wait longer: `sleep 3` before taking screenshot
- Check network: Ensure internet connection
- Verify search box exists: Use browser-eval to find search input

### Issue: Article content incomplete
- Scroll to bottom: Use browser-eval to simulate scrolling
- Wait for images: Help articles may load images dynamically
- Check for tabs: Some articles organize content in tabs

### Issue: Links return 404
- Article IDs change: Search for topic instead of using direct URL
- Category structure changes: Use home page navigation

## Common Article IDs and Categories

**Note**: Article URLs follow pattern: 
```
https://support.joinforma.com/hc/en-us/articles/ARTICLE_NUMBER
```

Browse from the main help center page to find current article IDs, as they may change or be reorganized.

## Help Center vs. In-App Information

| Aspect | Help Center | Dashboard Modal |
|--------|------------|-----------------|
| **Eligibility Lists** | Comprehensive, detailed | Quick reference only |
| **Explanations** | Extensive | Minimal |
| **Best Practices** | Yes, dedicated articles | No |
| **Search** | Yes, full-text search | No |
| **Examples** | Yes, common items listed | No examples |
| **Rules & Limits** | Detailed | Not covered |
| **Claims Info** | Dedicated category | Not available |
| **Year-End Guidance** | Yes, dedicated category | Not available |

---

## Quick Start

```bash
# 1. Start browser
browser-start.js &
sleep 3

# 2. Open help center
browser-nav.js https://support.joinforma.com/hc/en-us/
sleep 2

# 3. Search for topic
browser-eval.js '(function() {
  const searchBox = document.querySelector("input[placeholder*=\"Search\"]");
  searchBox.value = "YOUR_SEARCH_QUERY";
  searchBox.dispatchEvent(new Event("input", { bubbles: true }));
  return "Searching...";
})()' 

sleep 2

# 4. View results
browser-screenshot.js

# 5. Extract article links
browser-eval.js '(function() {
  return Array.from(document.querySelectorAll("a"))
    .filter(a => a.href.includes("/articles/"))
    .map(a => ({ title: a.textContent.trim(), url: a.href }));
})()' 
```
