# Decisió: Tailwind CSS v3 vs v4

## Decisió: Utilitzar Tailwind CSS v3.4.x

**Data**: 30 de març de 2026

## Context

Durant la implementació del projecte, inicialment es va instal·lar Tailwind CSS v4.0.0. Després de provar-ho, hem decidit tornar a la v3.4.x.

## Raons per usar Tailwind v3

### 1. Compatibilitat amb Spartan UI

Spartan UI està dissenyat i provat amb Tailwind CSS v3. La documentació i exemples de Spartan utilitzen la sintaxi v3:

```javascript
// tailwind.config.js (v3)
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        colla: {
          primary: 'var(--colla-primary)',
        }
      }
    }
  }
}
```

### 2. Sintaxi estable i documentada

Tailwind v3 té:
- ✅ Documentació completa i madura
- ✅ Suport ampli de la comunitat
- ✅ Plugins i integracions provades
- ✅ Exemples i tutorials abundants

### 3. Configuració més senzilla

**Tailwind v3:**
```scss
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Tailwind v4:**
```scss
@import 'tailwindcss';

@theme {
  --color-colla-primary: #1B5E20;
}
```

La sintaxi v3 és més clara i no genera avisos de deprecació amb Sass.

### 4. Menys problemes amb PostCSS

Tailwind v3 funciona directament amb PostCSS sense necessitat de plugins addicionals:

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},      // ✅ v3: funciona directament
    autoprefixer: {},
  },
};
```

Tailwind v4 requeria `@tailwindcss/postcss` com a plugin separat, afegint complexitat.

### 5. Les nostres rules estan pensades per v3

Totes les rules de `.cursor/rules/` fan referència a:
- `tailwind.config.js` amb la sintaxi v3
- CSS variables consumides via `var(--custom-prop)`
- Patterns de Spartan UI + Tailwind v3

## Problemes trobats amb Tailwind v4

1. **Error de PostCSS**: Requeria `@tailwindcss/postcss` com a dependència separada
2. **Sintaxi CSS diferent**: `@theme` vs `tailwind.config.js`
3. **Avisos de Sass**: `@import` està deprecated en Dart Sass
4. **Incompatibilitat potencial** amb Spartan UI (no està provat amb v4)
5. **Menys documentació** i exemples disponibles

## Quan considerar migrar a v4

Tailwind v4 pot ser una opció en el futur quan:
- Spartan UI tingui suport oficial per v4
- La documentació i comunitat siguin més madures
- Els beneficis de v4 superin els costos de migració

Per ara, v3.4.x és la millor opció per a aquest projecte.

## Configuració actual

### package.json
```json
{
  "devDependencies": {
    "tailwindcss": "^3.4.0"
  }
}
```

### tailwind.config.js
```javascript
module.exports = {
  content: [
    './apps/dashboard/src/**/*.{html,ts}',
    './apps/pwa/src/**/*.{html,ts}',
    './libs/**/*.{html,ts}',
  ],
  theme: {
    extend: {
      colors: {
        colla: {
          primary: 'var(--colla-primary)',
          secondary: 'var(--colla-secondary)',
          'text-on-primary': 'var(--colla-text-on-primary)',
        },
      },
    },
  },
  plugins: [],
};
```

### styles.scss
```scss
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --colla-primary: #1B5E20;
  --colla-secondary: #FDD835;
  --colla-text-on-primary: #FFFFFF;
}
```

## Referències

- [Tailwind CSS v3 Documentation](https://tailwindcss.com/docs)
- [Spartan UI Documentation](https://www.spartan.ng/)
- [Tailwind v4 Beta Announcement](https://tailwindcss.com/blog/tailwindcss-v4-beta)
