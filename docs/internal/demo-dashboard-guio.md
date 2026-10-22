---
tags: [qa]
---

# Guió de la demo del Dashboard per als tècnics

Per a qui presenta. Les pàgines del manual (Configuració → Manual) són el fil conductor: a cada bloc
obriu primer la pàgina (10 segons) i després feu la tasca en directe. Així queda clar on tornar a
buscar-ho.

**Format:** 1 h 30 min de videotrucada, Dashboard en pantalla compartida, unes 10 persones
(programadors i tècnics de pinyes, de troncs i de xicalla, tots junts). L'ordre segueix el flux real
de treball, no el menú.

---

## 1. Preparació (D-3 a D-0)

**Entorn**
- [ ] **On es fa la demo en directe:** preferiblement a preproducció (`docs/DEPLOY_PRE.md`), amb dades
  sincronitzades fa poc. Si ha de ser a producció:
  - l'event de prova es titula «PROVA DEMO, no feu cas»;
  - no es publica cap segment;
  - s'elimina en acabar.

  Els membres veuen a la PWA els events de producció.
- [ ] **El visor Configuració → Manual està desplegat** on es fa la demo. Si no ho està, ensenyeu el
  manual des de l'stack local.
- [ ] **Compte de qui presenta:**
  - ha de ser ADMIN, per a poder ensenyar la diferència de permisos;
  - ha de tindre la persona vinculada, perquè el xip mostre l'àlies i no el correu;
  - ha d'haver acceptat la política de privacitat;
  - la sessió ha d'estar ja oberta abans de compartir la pantalla.

**Dades**
- [ ] Una plantilla amb pinya, rengles, bases i un tronc de dos pisos o més, amb l'estructura feta.
  Feu-ne una còpia amb «Duplica» per a tocar-la en directe i esborreu-la en acabar.
- [ ] Un **event de demo** amb data futura (no bloquejat). Ha de tindre:
  - dos segments amb dues figures cadascun;
  - una plantilla que ja s'haja fet servir abans, perquè «Importa tronc/pinya» tinga d'on importar;
  - unes 25-30 persones marcades «Ve» a «Assistència», algunes amb 🎭 i alguna de xicalla.
- [ ] Un conflicte preparat a posta: una persona a la pinya i al tronc del mateix segment.
- [ ] Un assaig real ja passat amb molts segments, per a «Participació». Es mira, no es toca.
- [ ] Una persona provisional de prova («~Demo»), per a ensenyar una fitxa sense dades reals.

**Pantalla**
- [ ] Zoom del navegador al 125 %, tema clar, sense marcadors ni notificacions.
- [ ] Amagueu les columnes amb noms reals abans de compartir:
  - «Nom complet» a Persones;
  - «Nom» a Assistència i a Participació.
- [ ] Una segona pestanya amb la PWA en mida de mòbil: F12 → mode dispositiu → 390×844.
- [ ] **Assaig en sec de 30 min** del recorregut sencer, cronometrat.
- [ ] **Qui apunta:** algú anota en un document compartit tots els dubtes, trucs i maneres de fer que
  isquen. Després es bolquen al manual (vegeu el punt 4).

---

## 2. Agenda (90 min)

| Temps | Bloc | Pàgines | Qui ha de mirar |
|---|---|---|---|
| 0:00-0:05 | Benvinguda i on és el manual | 00, 01 | tothom |
| 0:05-0:15 | La base: dades de l'app antiga, persones, etiquetes | 02, 03, 04 (05, 06 breu) | tothom |
| 0:15-0:25 | Assajos i actuacions | 07 | tothom |
| 0:25-0:40 | Plantilles | 08 · 09 · 10 | 08 tothom · 09 pinyes · 10 troncs/xicalla |
| 0:40-0:50 | Esquelet de l'event: segments i figures | 11 | tothom; pinyes, els cordons |
| 0:50-1:05 | Assignació: troncs primer, pinyes després, conflictes | 12 · 13 · 14 | 12 troncs/xicalla · 13 pinyes · 14 tothom |
| 1:05-1:15 | Distribució, previsualització i projecció | 15, 16 | tothom |
| 1:15-1:20 | Participació | 17 | tothom |
| 1:20-1:25 | L'app dels membres (Comunicació, si queda temps) | 19 (18) | tothom |
| 1:25-1:30 | Preguntes i tancament | 20 | tothom |

**Marge:** si l'assignació s'allarga, salteu Comunicació i feu Participació en 3 minuts.

---

## 3. Guió per bloc

### 0:00-0:05 · Benvinguda (pàgines 00, 01)
1. Objectiu: que cadascú sàpia fer la seua part i on mirar quan s'encalle.
2. «Configuració» → «Manual». Ensenyeu:
   - els dos usos: consulta ràpida d'una pantalla i lectura ordenada;
   - la taula de recorregut per perfil i el glossari (segment = prova, lloc = node, «Menor de 16» = xicalla).
3. Recorregut ràpid per les pestanyes principals, una frase per pestanya. «Plantilles» és el mòdul de
   figures, però l'event es prepara des de l'event.
4. Digueu qui apunta els dubtes.

### 0:05-0:15 · La base (pàgines 02, 03, 04)
1. **Dades de l'app antiga (3 min).** Obriu la pàgina 02 i la taula «què mana on»:
   - l'alçada, el nom i l'assistència de l'app antiga manen, i la importació les sobreescriu;
   - les etiquetes i les delegacions només són d'ací i no es perden mai.

   **No importeu res en directe**: només ho pot fer ADMIN i tocaria dades reals. Un compte de tècnica
   veu els botons «Sincronitza», però rep un error.
2. **Persones (3 min).** Llista, «Cerca», «Sols actius» i el filtre «Falten etiquetes» (la regla és
   pinya **i** tronc). Obriu la fitxa de «~Demo»: «Edita», canvieu una observació tècnica i «Alça».
3. **Etiquetes (4 min).** `/config/tags`: els grups i «Posicions de figura». «Etiqueta persones» →
   «Pendents»: etiqueteu una persona en directe, amb l'ajuda de qui siga de troncs. **Missatge
   clau:** les etiquetes ordenen el panell i marquen amb un punt de color qui encaixa en el lloc
   seleccionat; no trien ningú ni bloquegen res.

Temporades i usuaris, només de paraula:
- sense la temporada nova no es poden crear els assajos del setembre;
- persona ≠ usuari;
- la invitació no s'envia per correu: l'enllaç es copia i el passeu vosaltres (caduca en 72 h).

### 0:15-0:25 · Assajos i actuacions (pàgina 07)
1. `/rehearsals`: «Quan» → «Propers», la ratlla «Events passats», la columna «Assistència».
2. **Crear l'event de demo en directe:**
   - «Assaig nou»;
   - una data fora de temporada, per a ensenyar l'error;
   - una data bona, amb «Compta per a estadístiques» marcat;
   - «Crea esdeveniment».
3. Regla d'or: si un event és a l'app antiga, no el creeu ací. Si el canvieu ací, la importació el
   torna com era.
4. Detall d'un assaig:
   - insígnies;
   - «Notes»: escriviu una línia i alceu-la;
   - «Imprimeix»: el PDF ja porta la nota;
   - «Assistència»: els estats canvien segons la fase (abans, el dia, després).
5. «Confirmació» a tota pantalla: escriviu dues lletres **sense tocar cap targeta** i tanqueu amb Esc.
6. Les actuacions passen de «Vaig» a «Assistit» automàticament a les 3 de la matinada del mateix dia.

### 0:25-0:40 · Plantilles (pàgines 08, 09, 10)
1. **Tothom (3 min):**
   - llista, «Duplica», «Composicions»;
   - a l'editor: «Alçat» (s'alça sol, no hi ha botó), «Desfer», previsualització.
   - **Missatge clau:** «si dissabte ja hi ha gent posada al Pilar, el que canviem ara a la plantilla
     no li arriba».
2. **Pinyes (6 min), sobre la còpia:**
   - pestanya «Pinya»: afegiu un node i mireu «Propietats del node»; bases en ordre antihorari;
   - pestanya «Rengles»: «Rengla nova», clics del centre cap enfora, «Finalitza». Per això a l'event
     es podran triar els cordons.
3. **Troncs i xicalla (6 min):**
   - pestanya «Tronc»: «Afegeix pis», «+» en un pis, «Tipus», «Pos.», «Amp.»;
   - «Estructura del tronc»: arrossegueu un enllaç («qui va damunt de qui») i esborreu-lo amb un clic.
     Gràcies a això, a l'assignació es veuen les alçades.

### 0:40-0:50 · Segments i figures (pàgina 11)
1. A l'event de demo, pestanya «Pinyes i Figures»:
   - «Segment nou» dues vegades i poseu nom al primer;
   - «+ Figura» → dues figures → «Confirma (2)»;
   - al segon segment, «Composicions»: fixeu-vos que el segment pren el nom de la composició.
2. **Hi ha prou gent?** Llegiu «x/y pinyes, x/y total» al costat de la targeta «Ve» o «Adults».
   - No hi ha cap comptador directe de mans que falten: es resta.
   - Reduïu un cordó amb «−» i mireu com baixa la xifra.
3. Vista «Troncs»: el resum del tronc i el selector «Completa»/«Peu»/«Remat»/«Neta», que només és
   ací. **Ordre de treball:** primer troncs i xicalla, després pinyes.
4. Publiqueu un segment amb l'ull i mireu-lo a la pestanya de la PWA. Desfeu-ho.

### 0:50-1:05 · Assignació i conflictes (pàgines 12, 13, 14)
1. «Assigna» → espai de treball: pestanyes, fletxes entre segments i «Bloquejat» (dos dies després de
   l'event).
2. **Troncs (6 min):**
   - cliqueu la base: la llista s'ordena per etiquetes i la casella «Xicalla» s'activa sola en llocs
     de tronc;
   - assigneu tres àlies seguits, moveu-ne un i feu «Desfer»;
   - mireu els avisos d'alçada;
   - «Importa tronc» d'un assaig anterior. **Compte:** importa també gent que no ve (punt roig).
3. **Panell (1 min):** els grups, 🎭, i que en clicar un lloc es refresca qui ha confirmat (cada 10 s).
4. **Pinyes (5 min):**
   - els comptadors «lliures» i «elegibles per a pinya» al costat de la insígnia del segment;
   - assigneu uns quants llocs;
   - poseu algú que ja és al tronc → «Persona ja assignada» → «Assignar igualment», per a crear el
     conflicte;
   - obriu «Reinicialitza» i **cancel·leu-lo**: també esborra el tronc i no es pot desfer.
5. **Conflictes (3 min):** barra roja → «Mostra» → «Veure on està assignada» → «Treure aquesta
   assignació». Són avisos, mai bloqueigs.

### 1:05-1:15 · Distribució i projecció (pàgines 15, 16)
1. «Distribució»: moveu i gireu una figura.
   - Reduïu un cordó d'una figura amb gent → «Canvia els cordons» → **cancel·leu**.
   - **Compte:** «Optimitza distribució», «Completa» i «Peu» s'apliquen sense preguntar i no es poden
     desfer.
2. «Nodes extra»: afegiu una «MANS» i assigneu-hi algú des de «Pinyes».
3. «Previsualitza», i després «Projecta» des de la llista: F, ←/→ entre segments, «?».
   - Esc dins de «Previsualitza» ix de l'espai de treball.
   - A la projecció es veuen també els segments no publicats.

### 1:15-1:20 · Participació (pàgina 17)
A l'assaig real passat:
1. Llegiu «Càrrega: mín · mitjana · màx · N sense cap col·locació» i ordeneu per «Col·locacions».
2. Busqueu qui no fa res.
3. «Només troncs» + columna «Troncs»; «Pròxima actuació».

### 1:20-1:25 · L'app dels membres (pàgina 19)
A la pestanya de la PWA:
1. «Inici».
2. «Agenda»: «Vaig» / «No vaig». **No canvieu cap resposta d'una altra persona.**
3. Detall d'un assaig, amb la caixa de xifres (només per a tècnics).
4. Projecció amb «on sou».
5. «Passa llista»: les pestanyes i «+ Persona nova», sense crear-ne cap. Ha d'eixir només el dia de
   l'event.

Si queda temps, Comunicació (pàgina 18): una notícia en «Esborrany», sense publicar ni notificar.

### 1:25-1:30 · Tancament
- Preguntes.
- Recordeu on és el manual i que els dubtes nous es fan arribar a l'equip.

---

## Preguntes probables (resposta curta)

| Pregunta | Resposta |
|---|---|
| He corregit una alçada i ha tornat a canviar. | Mana l'app antiga: corregiu-la allà. |
| He desactivat algú i ara n'hi ha dos. | Ho ha fet la importació. Doneu-lo de baixa a l'app antiga. |
| Per què no puc importar? | Cal un compte d'administració. |
| No em deixa crear l'assaig. | La data no és dins de cap temporada. |
| He canviat la plantilla i a l'assaig no ha canviat res. | La figura ja tenia gent assignada. «Reinicialitza» la torna a copiar, però en lleva tothom. |
| On és el botó d'alçar a l'editor? | No n'hi ha: s'alça sol. Mireu «Alçat». |
| On veig quantes mans em falten? | No hi ha comptador directe. Compareu el «total» del segment amb la gent que ve. |
| Per què no trobe X al panell? | Té «Menor de 16» i la casella «Xicalla» està desmarcada, no ha confirmat («Altres») o ja està col·locat. |
| Podem treballar dos alhora? | Sí, en segments diferents. |
| Ho puc fer des del mòbil? | Pinyes i Troncs, sí. Plantilles, Distribució, Nodes extra i Previsualitza, no. |
| Per què un membre no veu la pinya? | El segment no està publicat. |
| L'app envia el correu d'invitació? | No. Copieu l'enllaç i passeu-lo vosaltres; caduca en 72 h. |
| No puc canviar l'assistència de l'assaig de dissabte. | L'endemà ja és de només lectura al Dashboard; feu-ho des de «Passa llista» a la PWA. |

---

## 4. Després de la demo

- [ ] Si la demo es va fer a producció, elimineu l'event de demo i la còpia de la plantilla.
- [ ] Classifiqueu les notes del document compartit:
  - **pregunta** → `docs/manual/20-preguntes-frequents.md`;
  - **explicació que falta o que confon** → la pàgina de la pantalla;
  - **truc d'un tècnic** → bloc «Trucs» del seu perfil a la pàgina;
  - **error o millora de l'app** → `docs/DEBT.md` o un issue.
- [ ] Torneu a generar les captures afectades: `SHOTS=<prefix> pnpm run docs:manual-shots`.
- [ ] Envieu el missatge de seguiment:

> Gràcies per vindre a la demo del Dashboard. Tot el que vam veure és al Dashboard, a
> **Configuració → Manual**: hi ha una pàgina per cada pantalla, amb una part per a pinyes i una
> altra per a troncs i xicalla. Si vos encalleu en alguna pantalla, obriu el manual i busqueu-la pel
> nom. Si alguna cosa no s'entén o hi falta, feu-nos-ho saber i l'afegirem.

---
*Veïns: [[00-benvinguda]] · [[PINYES_MODULE]] · [[ad-hoc-nodes-user-guide]] · [[AUDIT_SUITE]]*
