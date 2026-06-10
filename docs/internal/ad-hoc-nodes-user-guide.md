# Nodes Ad-Hoc — Guia d'Usuari

> Aquesta guia serveix com a base per al modal d'ajuda dins l'aplicació.
> Destinada als tècnics i admins que fan servir la pantalla d'assignació.

---

## Què són els nodes ad-hoc?

Quan estàs assignant persones a una figura, a vegades necessites posicions que no existeixen al template original. Els **nodes ad-hoc** et permeten afegir posicions noves directament durant l'assignació, sense haver de modificar el template base.

Visualment es distingeixen per la seva **vora discontínua** (guions), a diferència dels nodes del template que tenen vora contínua.

---

## Quan fer-los servir?

| Situació | Exemple |
|----------|---------|
| **Cordons oberts extra** | Necessites un cordó obert que no estava previst al template |
| **Posicions especials** | Un "lateral-agulla" o "reforç" que només fa sentit per a aquest event |
| **Comodí** | Qualsevol posició no estàndard amb un nom personalitzat |
| **Elements decoratius** *(Fase 2)* | Marcar on queda l'església, una paret, un obstacle |
| **Direccions** *(Fase 3)* | Indicar cap on s'orienta la figura o la xicalla |

---

## Com crear un node ad-hoc

1. **Fes clic al botó "+"** (icona rodona, cantonada inferior dreta del canvas)
2. **Tria el tipus** de node del menú desplegable:
   - Agulla, Mans, Laterals, Vents, Cordó obert, Tap, Crossa, Contrafort
   - **Comodí** — et demanarà un nom personalitzat
3. **Fes clic al canvas** per col·locar el node on vulguis
4. El node apareixerà amb la vora discontínua — ja està llest per assignar!

> 💡 Prem **Escape** per cancel·lar la col·locació si canvies d'opinió.

---

## Com moure un node ad-hoc

- **Arrossega'l** (clic + mantenir + moure) cap a la posició desitjada
- La posició es desa automàticament quan deixes anar

---

## Com redimensionar o rotar

1. **Fes doble clic** sobre el node ad-hoc
2. Apareixeran les **nanses** (quadrats als cantons + àncora de rotació a dalt)
3. **Arrossega un cantó** per canviar la mida
4. **Arrossega l'àncora superior** per rotar (mantén Shift per saltar de 15° en 15°)
5. Prem **Escape** per sortir del mode d'edició

> Els nodes del template (vora contínua) NO es poden moure ni redimensionar.

---

## Com assignar una persona a un node ad-hoc

Exactament igual que amb qualsevol altre node:
1. **Fes un sol clic** al node (sense arrossegar)
2. **Selecciona la persona** al panell lateral

O a l'inrevés:
1. Selecciona la persona primer
2. Fes clic al node buit

---

## Com eliminar un node ad-hoc

1. **Selecciona** el node (clic)
2. Prem **Suprimir** o **Backspace**
3. Si el node té una persona assignada, apareixerà un avís de confirmació

> Només els nodes ad-hoc es poden eliminar individualment.

---

## Diferències amb els nodes del template

| Característica | Nodes del template | Nodes ad-hoc |
|---|---|---|
| **Origen** | Copiats del template en fer el snapshot | Creats manualment durant l'assignació |
| **Aparença** | Vora contínua | Vora discontínua (guions) |
| **Moviment** | Fixos — no es poden moure | Lliures — arrossega per moure |
| **Redimensió** | No | Sí (doble clic → nanses) |
| **Rotació** | No | Sí (doble clic → àncora rotació) |
| **Eliminació** | No es poden eliminar individualment | Sí (Suprimir/Backspace) |
| **Import** | Es copien per posició/rengla | Es copien íntegrament amb assignacions |
| **Relació amb template** | Canvis posteriors al template no afecten | No tenen cap relació amb el template |

---

## Coses importants a recordar

### El reset ho esborra TOT
Si fas **"Reset pinya"**, es perdran TOTS els nodes (template + ad-hoc) i TOTES les assignacions. L'aplicació t'avisarà si hi ha nodes ad-hoc.

### El bloqueig s'aplica
Quan un event està bloquejat (passat el termini d'edició), **no es poden afegir, moure ni eliminar** nodes ad-hoc.

### L'import els copia
Quan importes assignacions d'una altra instància, els nodes ad-hoc d'aquella instància es copiaran automàticament juntament amb les seves assignacions.

### Canvis al template no afecten
Si algú modifica el template base després de crear la instància, **cap node canvia** — ni els del snapshot ni els ad-hoc. El botó "Editar template" t'ho recordarà.

---

## Dreceres de teclat

| Tecla | Acció |
|-------|-------|
| **Clic** | Seleccionar node (per assignar) |
| **Arrossegar** | Moure node ad-hoc |
| **Doble clic** | Mode redimensió/rotació |
| **Escape** | Cancel·lar acció / sortir de mode |
| **Suprimir / Backspace** | Eliminar node ad-hoc seleccionat |
| **Tab** | Avançar al següent node buit |
