---
name: forma-website-browsing
description: Automate browsing and interactions on the Forma benefits website. Includes navigation, accessing benefits dashboards, viewing eligibility information, and interacting with benefit cards.
---

# Forma Website Browsing Automation

Forma (joinforma.com / client.joinforma.com) is a benefits management platform for companies like Robinhood. This skill provides techniques for automating interactions with the Forma website using browser automation tools.

## Key Concepts

### Forma Website Structure

**Public Site**: `https://www.joinforma.com`
- Marketing and information pages
- Sign up and login flows
- General benefit information

**Client Dashboard**: `https://client.joinforma.com`
- Requires authentication (login via company SSO or credentials)
- Personalized benefits overview
- Account details and eligibility information
- Store/marketplace for benefit products

### Dashboard Layout

The authenticated dashboard includes:
- **Navigation**: Home, Store, Benefits, Claims
- **User Profile**: Top right with account menu
- **Benefits Cards**: Grid display of active benefits
- **Quick Links**: Manage Forma Card, Orders, Policy, Help Center
- **Forma Store**: Product recommendations and marketplace

### Benefit Account Types

- **Lifestyle Wallet**: Flexible spending account for wellness/lifestyle purchases
- **FSA (Flexible Spending Account)**: Medical expense account
- **Transit Account**: Public transportation benefits
- Other employer-specific accounts

## Accessing Eligibility Information

### DOM Structure for Benefit Cards

Each benefit card contains:
1. Account name/title
2. "What's eligible?" link (blue, clickable)
3. Available balance

### Finding and Clicking "What's Eligible?" Links

The "What's eligible?" links are typically nested in SPAN elements within the benefit card container. They trigger a modal dialog showing eligible categories.

**Challenge**: Multiple "What's eligible?" links exist on the page (one per benefit card). You must target the correct one for the desired account.

**Solution**: Use text node traversal to find the specific link:

```javascript
(function() {
  // Find all text nodes with "What's eligible?"
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  const nodes = [];
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.includes("What's eligible?")) {
      nodes.push(node);
    }
  }
  
  // nodes[0] = Lifestyle Wallet
  // nodes[1] = FSA
  // nodes[2] = Transit Account
  
  if (nodes.length >= 2) {
    const targetNode = nodes[1]; // FSA example
    let clickable = targetNode.parentElement;
    let attempts = 0;
    
    // Walk up to find clickable parent
    while (clickable && !["A", "BUTTON"].includes(clickable.tagName) && 
           !clickable.onclick && clickable.getAttribute("role") !== "button" && attempts < 10) {
      clickable = clickable.parentElement;
      attempts++;
    }
    
    if (clickable) {
      clickable.click();
      return "Clicked What's eligible for FSA";
    }
  }
  
  return "Failed to find link";
})()
```

**Important Note**: The SPAN element itself is clickable (not necessarily a parent A or BUTTON tag). If the walkup doesn't find a traditional link element, the SPAN may be the target. The code will successfully click even on SPAN elements with click handlers.

### Eligibility Modal Structure

When a "What's eligible?" link is clicked, a modal opens showing:
- Account name (e.g., "Flexible Savings Account (FSA)")
- "Eligible categories" section
- Info box with link to "Learn More"
- Organized list of eligible items by category

**Categories may include:**
- Dental (treatment, foreign care, OTC drugs, etc.)
- Medical Insurance (copayment, deductible, coinsurance, etc.)
- Lab Services
- Vision Care
- And more depending on the account type

**Special Indicators:**
- `*` (asterisk) = Requires letter of medical necessity

### Dismissing and Re-opening the Modal

The eligibility modal can be dismissed and reopened.

**Dismiss the modal:**
```javascript
// Send ESC key to close modal
const event = new KeyboardEvent("keydown", {
  key: "Escape", 
  code: "Escape", 
  keyCode: 27
});
document.dispatchEvent(event);
```

**Re-open the modal after dismissal:**
Use the same text node traversal technique. The link becomes clickable again after the modal closes.

**Complete example: Close, wait 1 second, reopen:**
```bash
# Close modal
browser-eval.js '(function() {
  const event = new KeyboardEvent("keydown", {key: "Escape", code: "Escape", keyCode: 27});
  document.dispatchEvent(event);
  return "Modal dismissed";
})()' 

# Wait 1 second
sleep 1

# Reopen modal
browser-eval.js '(function() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.includes("What'\''s eligible?")) {
      nodes.push(node);
    }
  }
  
  if (nodes.length >= 2) {
    let clickable = nodes[1].parentElement;
    let attempts = 0;
    while (clickable && !["A", "BUTTON"].includes(clickable.tagName) && !clickable.onclick && attempts < 10) {
      clickable = clickable.parentElement;
      attempts++;
    }
    
    if (clickable) {
      clickable.click();
      return "Modal reopened";
    }
  }
  return "Failed to reopen";
})()' 

# Take screenshot to verify
sleep 1
browser-screenshot.js
```

## Authentication

The client dashboard requires authentication. You can:
1. **Use browser profile with saved login**: `browser-start.js --profile`
2. **Manual login**: Navigate to login page and authenticate through SSO

## Workflow Examples

### Example 1: View FSA Eligibility

```bash
# Navigate to dashboard
browser-nav.js https://client.joinforma.com

# Wait for page to load
sleep 2

# Take screenshot to verify login state
browser-screenshot.js

# Click FSA "What's eligible?" link
browser-eval.js '(function() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.includes("What'\''s eligible?")) {
      nodes.push(node);
    }
  }
  
  if (nodes.length >= 2) {
    let clickable = nodes[1].parentElement;
    while (clickable && !["A", "BUTTON"].includes(clickable.tagName)) {
      clickable = clickable.parentElement;
    }
    if (clickable) {
      clickable.click();
      return "Clicked FSA eligibility";
    }
  }
  return "Failed";
})()' 

# Wait for modal to appear
sleep 1

# Screenshot the eligibility modal
browser-screenshot.js

# Extract eligibility content
browser-eval.js '(function() {
  const modal = document.querySelector("[role=dialog]");
  if (modal) {
    return modal.innerText;
  }
  return "No modal found";
})()' 
```

### Example 2: Extract All Benefits and Balances

```bash
browser-eval.js '(function() {
  const cards = Array.from(document.querySelectorAll("[class*=\"sc\"]")).filter(card => {
    const text = card.innerText;
    return (text.includes("$") || text.includes("available")) && 
           (text.includes("Wallet") || text.includes("Account"));
  });
  
  return cards.map(card => ({
    text: card.innerText.slice(0, 200),
    html: card.innerHTML.slice(0, 500)
  }));
})()' 
```

### Example 3: Navigate to Benefits Page

```bash
# Click "Benefits" in navigation
browser-eval.js '(function() {
  const benefitsLink = Array.from(document.querySelectorAll("a")).find(a => 
    a.textContent.trim() === "Benefits"
  );
  if (benefitsLink) {
    benefitsLink.click();
    return "Navigated to Benefits page";
  }
  return "Link not found";
})()' 

sleep 2
browser-screenshot.js
```

### Example 4: Dismiss and Reopen Eligibility Modal

```bash
# First, open the FSA eligibility modal
browser-eval.js '(function() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.includes("What'\''s eligible?")) {
      nodes.push(node);
    }
  }
  
  if (nodes.length >= 2) {
    let clickable = nodes[1].parentElement;
    let attempts = 0;
    while (clickable && !["A", "BUTTON"].includes(clickable.tagName) && !clickable.onclick && attempts < 10) {
      clickable = clickable.parentElement;
      attempts++;
    }
    
    if (clickable) {
      clickable.click();
      return "FSA eligibility modal opened";
    }
  }
  return "Failed";
})()' 

sleep 1

# Screenshot to confirm modal is open
browser-screenshot.js

# Dismiss the modal with ESC key
browser-eval.js '(function() {
  const event = new KeyboardEvent("keydown", {key: "Escape", code: "Escape", keyCode: 27});
  document.dispatchEvent(event);
  return "Modal dismissed";
})()' 

sleep 1

# Screenshot to confirm modal closed
browser-screenshot.js

# Wait 1 second, then reopen
sleep 1

browser-eval.js '(function() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.includes("What'\''s eligible?")) {
      nodes.push(node);
    }
  }
  
  if (nodes.length >= 2) {
    let clickable = nodes[1].parentElement;
    let attempts = 0;
    while (clickable && !["A", "BUTTON"].includes(clickable.tagName) && !clickable.onclick && attempts < 10) {
      clickable = clickable.parentElement;
      attempts++;
    }
    
    if (clickable) {
      clickable.click();
      return "FSA eligibility modal reopened";
    }
  }
  return "Failed to reopen";
})()' 

sleep 1

# Final screenshot showing modal is open again
browser-screenshot.js
```

## Tips & Troubleshooting

### Issue: "What's eligible?" link clicks wrong benefit card

**Solution**: Use text node traversal with array indexing to target the correct account:
- Index 0 = Lifestyle Wallet
- Index 1 = FSA/Flexible Spending
- Index 2 = Transit Account

### Issue: Modal doesn't appear after clicking link

**Solutions**:
1. Wait longer: Add `sleep 2` before taking screenshot
2. Check if you're authenticated (take screenshot to verify)
3. Verify the correct link was clicked using browser-eval to extract DOM
4. If reopening after dismiss, wait at least 1 second before attempting to click again
5. Try clicking the SPAN element directly instead of walking up to a parent element

### Issue: Selectors fail due to styled-components

**Solution**: Forma uses styled-components with random class names. Avoid relying on class names. Instead:
- Use text content matching
- Walk the DOM tree looking for text nodes
- Use element relationships (parent/sibling) to find targets

### DOM Inspection Tips

Always start by examining the page structure:

```bash
browser-eval.js '(function() {
  return {
    title: document.title,
    url: document.location.href,
    buttons: document.querySelectorAll("button").length,
    links: document.querySelectorAll("a").length,
    dialogs: document.querySelectorAll("[role=dialog]").length,
    mainContent: document.body.innerText.slice(0, 2000)
  };
})()' 
```

## Modal Interaction Best Practices

### Timing Considerations

- **After clicking "What's eligible?"**: Wait at least 0.5-1s for modal animation
- **After ESC/dismiss**: Modal closes immediately but the page may need to re-render
- **Before re-clicking**: Wait 1+ second after dismissal before attempting to reopen
- Always add `sleep` between interactions with modals

### Checking Modal State

```bash
# Check if modal is visible
browser-eval.js '(function() {
  const modal = document.querySelector("[role=dialog]");
  return {
    exists: !!modal,
    visible: modal ? modal.offsetParent !== null : false,
    text: modal ? modal.innerText.slice(0, 100) : null
  };
})()' 
```

### Scrolling Inside Modal

If the eligibility list is long, you may need to scroll within the modal:

```bash
browser-eval.js '(function() {
  const modal = document.querySelector("[role=dialog]");
  if (modal) {
    modal.scrollTop += 300; // Scroll down 300px
    return "Scrolled modal";
  }
  return "No modal found";
})()' 
```

## Integration with Other Skills

- **browser-tools**: Core automation (navigation, evaluation, screenshots)
- **brave-search**: Find information about Forma benefits and policies
- **vscode**: Compare eligibility information across accounts

## Common Paths and Navigation

| Page | URL | Purpose |
|------|-----|---------|
| Home | `https://client.joinforma.com/` | Dashboard overview |
| Benefits | `https://client.joinforma.com/accounts` | All benefit accounts |
| Claims | `https://client.joinforma.com/claims` | Submit and view claims |
| Store | `https://client.joinforma.com/explore` | Browse benefit products |
| Settings | `https://client.joinforma.com/settings` | Account settings |
| Card Management | `https://client.joinforma.com/settings/pretax/forma-cards` | Manage benefit card |
| Order History | `https://client.joinforma.com/history/orders` | Past purchases |

## Forma Marketing Site Navigation

| Page | URL | Purpose |
|------|-----|---------|
| Home | `https://www.joinforma.com/` | Marketing homepage |
| Login | `https://client.joinforma.com/login` | Authentication |
| Public Benefits Info | `https://www.joinforma.com/resources` | Educational content |
