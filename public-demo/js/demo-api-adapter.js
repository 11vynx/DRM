/**
 * Demo API Adapter - Intercepts fetch calls and returns mock data
 * This file enables the UI to function offline on GitHub Pages
 * It caches demo data and simulates API responses
 */

const DEMO_API_ADAPTER = {
  // Cache for loaded demo data
  dataCache: {},

  // Demo data map - route patterns to data files
  dataMap: {
    "/api/lgus": "/data/lgus.json",
    "/api/barangays": "/data/barangays.json",
    "/api/equipment": "/data/equipment.json",
    "/api/vehicles": "/data/vehicles.json",
    "/api/personnel": "/data/personnel.json",
    "/api/admin/all-incidents": "/data/incidents.json",
    "/api/admin/portals": "/data/portals.json",
    "/api/agency-manifests": "/data/manifests.json",
  },

  /**
   * Load demo data from JSON files
   */
  async loadData(dataPath) {
    if (this.dataCache[dataPath]) {
      return this.dataCache[dataPath];
    }

    try {
      const response = await fetch(dataPath);
      if (!response.ok) {
        console.warn(`Failed to load demo data from ${dataPath}`);
        return null;
      }
      const data = await response.json();
      this.dataCache[dataPath] = data;
      return data;
    } catch (error) {
      console.warn(`Error loading demo data from ${dataPath}:`, error);
      return null;
    }
  },

  /**
   * Match API route and get corresponding data file
   */
  findDataFile(url) {
    const pathname = new URL(url, window.location.origin).pathname;

    // Check exact matches first
    if (this.dataMap[pathname]) {
      return this.dataMap[pathname];
    }

    // Check pattern matches for parameterized routes
    if (pathname.startsWith("/api/barangays/")) {
      return "/data/barangays.json";
    }
    if (pathname.startsWith("/api/agency-manifest/")) {
      return "/data/manifests.json";
    }
    if (pathname.startsWith("/api/lgu/my-incidents/")) {
      return "/data/incidents.json";
    }
    if (pathname.startsWith("/api/admin/incident/")) {
      return "/data/incidents.json";
    }

    return null;
  },

  /**
   * Check if a URL is an API call we should intercept
   */
  isApiCall(url) {
    try {
      const pathname = new URL(url, window.location.origin).pathname;
      return pathname.startsWith("/api/");
    } catch {
      return false;
    }
  },

  /**
   * Check if a URL is an external resource (should not be intercepted)
   */
  isExternalResource(url) {
    try {
      const urlObj = new URL(url);
      // Allow external URLs for maps, CDNs, etc.
      return urlObj.hostname !== window.location.hostname;
    } catch {
      return false;
    }
  },

  /**
   * Create a mock response
   */
  createResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status: status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  },

  /**
   * Handle demo login - return mock user token
   */
  handleLogin(url, options) {
    const body = JSON.parse(options.body || "{}");

    // Mock successful login
    const mockResponse = {
      success: true,
      token: "demo-jwt-token-" + Date.now(),
      user: {
        id: 1,
        username: body.username || "demo_user",
        email: body.email || "demo@example.com",
        role: "admin",
        created_at: new Date().toISOString(),
      },
    };

    return this.createResponse(mockResponse);
  },

  /**
   * Handle demo incident creation
   */
  handleIncidentCreate(url, options) {
    const body = JSON.parse(options.body || "{}");

    const mockIncident = {
      success: true,
      id: Math.floor(Math.random() * 10000),
      incident_name: body.incident_name,
      incident_code: "INC-DEMO-" + Date.now(),
      created_at: new Date().toISOString(),
      message: "Incident created successfully (demo mode)",
    };

    return this.createResponse(mockIncident, 201);
  },

  /**
   * Handle demo manifest submission
   */
  handleManifestCreate(url, options) {
    const body = JSON.parse(options.body || "{}");

    const mockManifest = {
      success: true,
      id: Math.floor(Math.random() * 10000),
      agency_name: body.agency_name,
      portal_location: body.portal_location,
      created_at: new Date().toISOString(),
      message: "Manifest submitted successfully (demo mode)",
    };

    return this.createResponse(mockManifest, 201);
  },

  /**
   * Handle demo report submission
   */
  handleReportCreate(url, options) {
    const body = JSON.parse(options.body || "{}");

    const mockReport = {
      success: true,
      id: Math.floor(Math.random() * 10000),
      report_type: body.report_type,
      submitted_by: body.submitted_by,
      created_at: new Date().toISOString(),
      message: "Report submitted successfully (demo mode)",
    };

    return this.createResponse(mockReport, 201);
  },

  /**
   * Intercept and handle fetch requests
   */
  async handleFetch(url, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const pathname = new URL(url, window.location.origin).pathname;

    // Skip external resources (maps, CDNs)
    if (this.isExternalResource(url)) {
      return null; // Let real fetch handle it
    }

    // Handle login endpoints
    if (method === "POST" && pathname.includes("/login")) {
      return this.handleLogin(url, options);
    }

    // Handle incident creation
    if (method === "POST" && pathname === "/api/incident") {
      return this.handleIncidentCreate(url, options);
    }

    // Handle manifest creation
    if (method === "POST" && pathname === "/api/agency-manifest") {
      return this.handleManifestCreate(url, options);
    }

    // Handle report creation
    if (method === "POST" && pathname.includes("/report")) {
      return this.handleReportCreate(url, options);
    }

    // Handle GET requests for data
    if (method === "GET") {
      const dataFile = this.findDataFile(url);
      if (dataFile) {
        const data = await this.loadData(dataFile);
        if (data) {
          // Handle parameterized routes
          if (pathname.startsWith("/api/barangays/")) {
            const lguId = pathname.split("/").pop();
            const barangays = data[lguId];
            return this.createResponse(barangays || []);
          }

          if (pathname.startsWith("/api/agency-manifest/")) {
            const manifestId = pathname.split("/").pop();
            const manifest = data.find((m) => m.id == manifestId);
            return this.createResponse(manifest || {});
          }

          return this.createResponse(data);
        }
      }
    }

    // For PUT/DELETE/unhandled methods, return mock success
    if (method === "PUT" || method === "DELETE") {
      return this.createResponse({
        success: true,
        message: "Operation successful (demo mode)",
      });
    }

    return null; // Let real fetch handle it
  },
};

// Override fetch globally
const originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
  // Check if this is an API call
  if (DEMO_API_ADAPTER.isApiCall(url)) {
    // Try to handle with demo adapter
    const demoResponse = DEMO_API_ADAPTER.handleFetch(url, options);
    if (demoResponse && demoResponse instanceof Promise) {
      return demoResponse;
    } else if (demoResponse) {
      return Promise.resolve(demoResponse);
    }
  }

  // Fall back to real fetch for external resources, files, etc.
  return originalFetch.call(this, url, options);
};

// Add demo mode indicator
console.log(
  "%c🎭 DEMO MODE ACTIVE",
  "color: #ff6600; font-size: 16px; font-weight: bold;",
);
console.log(
  "%cThis UI is running in offline demo mode. All data is mock data.",
  "color: #ff9900; font-size: 12px;",
);
console.log(
  "%cAPI Calls are being intercepted and returning demo data from /data/ folder.",
  "color: #ff9900; font-size: 12px;",
);
