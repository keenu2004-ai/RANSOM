import http from 'http';
import https from 'https';

/**
 * Reverse-geocode latitude and longitude into a human-readable location string.
 * Gracefully returns fallback string or null on network failure/timeout to prevent blocking attendance.
 */
export async function reverseGeocode(latitude?: number | null, longitude?: number | null): Promise<string | null> {
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return null;
  }

  const fallback = `GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`;

    const locationName = await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(fallback), 2500);

      const req = https.get(url, {
        headers: { 'User-Agent': 'Theiakshi-HRMS/1.0' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timeout);
          try {
            if (res.statusCode === 200) {
              const json = JSON.parse(data);
              if (json.display_name) {
                const parts = json.display_name.split(', ');
                // Pick top 3-4 landmark/street/city parts for concise readable name
                const shortName = parts.slice(0, 4).join(', ');
                resolve(shortName || json.display_name);
                return;
              }
            }
            resolve(fallback);
          } catch {
            resolve(fallback);
          }
        });
      });

      req.on('error', () => {
        clearTimeout(timeout);
        resolve(fallback);
      });
    });

    return locationName || fallback;
  } catch {
    return fallback;
  }
}
