const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Proxy para Claude API (evita exponer la key en el frontend)
app.post('/api/recipes', async (req, res) => {
  const { items, context } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key no configurada. Añade ANTHROPIC_API_KEY en las variables de entorno de Vercel.' });
  }

  const prompt = context === 'fridge'
    ? `Tengo en mi nevera/congelador estos ingredientes: ${items.join(', ')}. 
       Sugiere 4 recetas concretas y variadas que pueda preparar esta semana con estos ingredientes. 
       Para cada receta incluye: nombre, tiempo de preparación, dificultad (fácil/media/difícil), 
       y una descripción corta (2-3 líneas). Responde en español en formato JSON con este schema:
       {"recipes": [{"name": "...", "time": "...", "difficulty": "...", "description": "..."}]}`
    : `He comprado estos ingredientes: ${items.join(', ')}. 
       Sugiere 4 recetas concretas y variadas que pueda preparar esta semana. 
       Para cada receta incluye: nombre, tiempo de preparación, dificultad (fácil/media/difícil), 
       y una descripción corta (2-3 líneas). Responde en español en formato JSON con este schema:
       {"recipes": [{"name": "...", "time": "...", "difficulty": "...", "description": "..."}]}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Error de API' });
    }

    const text = data.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      res.json(parsed);
    } else {
      res.json({ recipes: [] });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al contactar la IA' });
  }
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;