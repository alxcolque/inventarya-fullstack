// geolocation.js

const API_KEY = import.meta.env.VITE_API_KEY_GEOCODING; // Reemplaza con tu clave API

async function getCityName(location) {
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${location}&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.results && data.results.length > 0) {
      const components = data.results[0].components;
      return components.city || components.town || components.village || 'Ciudad desconocida';
    } else {
      throw new Error('No se pudo obtener la ubicación');
    }
  } catch (error) {
    console.error('Error al obtener el nombre de la ciudad:', error);
    throw error;
  }
}

export { getCityName };
