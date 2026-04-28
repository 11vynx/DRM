# DRM UI Demo Mode - GitHub Pages Deployment

This folder contains the UI-only demo version of the DRM system for static deployment on GitHub Pages.

## What is this?

- **Live UI**: All frontend pages and functionality work exactly as in production
- **Mock Data**: All API calls are intercepted and return demo data from `/data/` folder
- **No Backend**: Database, authentication, and real data writes are simulated
- **Offline Safe**: Works completely offline and on GitHub Pages

## How it works

1. **Demo API Adapter** (`js/demo-api-adapter.js`)
   - Intercepts all `fetch()` calls to `/api/*` routes
   - Returns mock data from `/data/*.json` files
   - Simulates successful POST responses for form submissions
   - Logs to browser console in demo mode

2. **Demo Data** (`/data/` folder)
   - `lgus.json`: Sample LGU (Local Government Units) data
   - `barangays.json`: Sample barangay/district data
   - `incidents.json`: Sample incident records
   - `equipment.json`: Sample equipment inventory
   - `vehicles.json`: Sample vehicle inventory
   - `personnel.json`: Sample personnel roster
   - `manifests.json`: Sample manifest submissions
   - `portals.json`: Sample portal status data

## Deployment to GitHub Pages

### Method 1: GitHub Pages with `docs/` folder

1. Copy contents of this folder (`public-demo`) to a `docs/` folder in your repo root:

   ```bash
   cp -r public-demo docs
   ```

2. Push to GitHub:

   ```bash
   git add docs/
   git commit -m "Add UI demo for GitHub Pages"
   git push origin ui-demo-pages
   ```

3. In GitHub repository settings:
   - Go to Settings → Pages
   - Source: `Deploy from a branch`
   - Branch: `ui-demo-pages` / folder: `docs/`
   - Save

4. Your UI will be live at: `https://yourusername.github.io/yourrepo/`

### Method 2: GitHub Pages with `gh-pages` branch

1. Create a new branch for deployment:

   ```bash
   git checkout -b gh-pages
   ```

2. Copy `public-demo` contents:

   ```bash
   cp -r public-demo/* .
   rm -rf public-demo
   ```

3. Push and set as GitHub Pages source:

   ```bash
   git add .
   git commit -m "Deploy UI demo to GitHub Pages"
   git push origin gh-pages
   ```

4. In GitHub repository settings:
   - Go to Settings → Pages
   - Source: `Deploy from a branch`
   - Branch: `gh-pages` / folder: `/ (root)`
   - Save

5. Your UI will be live at: `https://yourusername.github.io/yourrepo/`

## Important Notes

### For Demo Only

- ❌ User authentication is simulated - passwords are not validated
- ❌ Data persistence does not work - refreshing clears form data
- ❌ Real-time updates (Socket.io) are not available
- ❌ File uploads and downloads are simulated
- ❌ Role-based access control is not enforced

### What Works

- ✅ All UI pages load and render
- ✅ Form submission works (data is logged to console)
- ✅ Navigation between pages
- ✅ Responsive design
- ✅ Data display and filtering
- ✅ Charts and visualizations

## Customizing Demo Data

To change demo data:

1. Edit the JSON files in `/data/` folder
2. Follow the existing structure and data types
3. Browser will cache the data - clear cache to reload

Example:

```json
{
  "id": 1,
  "name": "Your Custom Incident",
  "status": "Active"
}
```

## Troubleshooting

**Issue**: Data not loading

- Solution: Open browser console (F12) and check for errors
- Look for messages starting with "🎭 DEMO MODE ACTIVE"

**Issue**: Forms not responding

- Solution: Check if demo adapter is loaded in browser console
- Forms are functional but data is not persisted

**Issue**: Maps not showing

- Solution: External map libraries (Leaflet, etc.) load normally
- Demo adapter only intercepts `/api/` calls

## Keeping Your Main System Safe

- This demo is in a separate `ui-demo-pages` branch
- Your main development branch is untouched
- All changes are isolated to `public-demo/` folder
- Original backup tag: `pre-pages-demo-2026-04-28`

To restore original state:

```bash
git checkout main  # or your main branch
```

## Support for Updates

When you update the main `public/` folder:

1. Merge changes into `public-demo/` on demo branch
2. Update `/data/` files with new mock data if structure changed
3. Redeploy to GitHub Pages

---

**Demo Created**: April 28, 2026  
**System**: DRREAMS Incident Command System  
**Purpose**: UI-only showcase without backend deployment
