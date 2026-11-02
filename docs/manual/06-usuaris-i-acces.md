<!-- rutes: /config/users /config/users/devices /config/legal -->

# Usuaris i accés

## Per a què serveix

Decidir qui pot entrar a MuixerApp i què hi pot fer.

## On és

«Configuració» → targeta «Usuaris». La targeta «Privacitat i legal» només la veuen els administradors.

![Llista d'usuaris](img/06-usuaris-llista.png)

## Persones i usuaris no són el mateix

- Una **persona** és algú de la colla. És al cens (pantalla [Persones](03-persones.md)), té assistència i se la pot col·locar a les figures. Quasi totes vénen de l'app antiga.
- Un **usuari** és un compte per a entrar a l'app, amb correu i contrasenya.
- Una persona pot no tindre usuari. Llavors no entra mai a l'app, però la podeu col·locar igual.
- Un usuari es pot vincular a una persona. És el que permet que un membre s'apunte als assajos des del mòbil.
- La xicalla no té usuari propi: ho gestiona un adult responsable. Vegeu [Persones](03-persones.md).

## Rols

| Rol | Què pot fer |
|---|---|
| «Membre» | Només l'app del mòbil: apuntar-se i veure on li toca. **No pot entrar al Dashboard.** |
| «Tècnica» | Tot el Dashboard, i a l'app del mòbil les opcions de tècnica («Passa llista», recomptes). |
| «Administrador» | El mateix que «Tècnica» i, a més: «Assignar rol», «Privacitat i legal», la sincronització amb l'app antiga i canviar comptes d'administrador. |

## Pas a pas

### Donar accés a un membre: l'enllaç d'invitació

És la manera normal. Es fa des de la fitxa de la persona, no des d'esta pantalla.

1. Aneu a Persones, obriu la persona i, a la part del compte, feu clic a «Crea enllaç d'invitació».
2. L'enllaç es copia sol. Si el navegador no ho permet, l'enllaç ix dins del missatge verd.
3. **L'app no envia cap correu.** Heu d'enviar-li l'enllaç vosaltres, per WhatsApp, per correu o com vulgueu.
4. La persona obri l'enllaç al mòbil, arriba a la pantalla «Activa el teu compte» i tria la contrasenya.
5. Fins que no l'activa, la fitxa diu «Pendent d'activar». Després diu «Compte actiu».
6. L'enllaç caduca al cap de 72 hores. Si caduca, torneu a fer clic a «Crea enllaç d'invitació»: se'n crea un de nou i l'anterior deixa de funcionar.

Trobareu el botó i les captures a [Persones](03-persones.md). Què veu el membre en entrar, a [L'app dels membres (PWA)](19-pwa.md).

### Crear un compte de tècnica

1. Feu clic a «Crea usuari».
2. Si voleu, trieu la persona a «Persona vinculada» («Cerca persona per vincular...»). Si ja té compte, ix l'avís «Esta persona ja està vinculada a un altre usuari.».
3. Ompliu «Correu electrònic» i «Contrasenya temporal» (mínim 8 caràcters).
4. Trieu el «Rol *». Una tècnica només pot triar «Tècnica»; un administrador també pot triar «Administrador».
5. Feu clic a «Crea usuari».

![Crea usuari](img/06-usuari-nou.png)

Passeu la contrasenya a la persona per un canal privat i digueu-li que la canvie. Al Dashboard no hi ha cap opció per a canviar-la: es fa des de l'app del mòbil (Perfil → Configuració → «Contrasenya») o amb «Heu oblidat la contrasenya?» a la pantalla d'entrada.

«Crea usuari» no serveix per a fer membres: per a un membre, feu servir l'enllaç d'invitació.

### Buscar usuaris

- «Cerca» busca per correu o nom.
- «Rols» filtra per un o més rols.
- «Sols actius» amaga els comptes desactivats.
- «Amb accés» deixa només els comptes que ja tenen contrasenya, és a dir, que ja s'han activat.
- La columna «Invitació expira» està amagada: activeu-la a «Columnes visibles».

### Canviar un usuari

Feu clic al botó «…» de la dreta de la fila («Accions»):

![Accions d'un usuari](img/06-usuari-accions.png)

- «Editar»: canvia el correu o la persona vinculada. El rol no es canvia ací.
- «Assignar rol» (només administradors): trieu «Membre», «Tècnica» o «Administrador» i feu clic a «Confirma». Així es fa tècnica una persona que ja tenia compte de membre.
- «Desactivar»: després de confirmar amb «Desactiva», la persona perd l'accés **al moment**, també en les sessions que tenia obertes. «Activar» i «Activa» li'l tornen.

![Assignar rol](img/06-assignar-rol.png)

### Dispositius i sessions (només administradors)

A la capçalera d'«Usuaris», feu clic a «Dispositius i sessions». També hi podeu arribar des de «Comunicació», a la targeta «Notificacions». La pantalla mostra tots els comptes amb estes columnes:

- «Àlies» i «Usuari» (nom i correu).
- «Sessions»: quantes sessions obertes té el compte.
- «Dispositius»: quants dispositius reben notificacions.
- «Darrer accés»: l'última vegada que va entrar o que la sessió es va renovar. Si fa més d'un mes que no entra, apareix «—».
- «Darrera notificació»: l'última notificació que va rebre algun dels seus dispositius.
- «Invitació»: «Pendent fins al dd/MM» si té un enllaç d'invitació que encara funciona, «Caducada» si l'enllaç ja no funciona, o buit si no en té cap.

Podeu cercar per àlies, nom o correu i ordenar per qualsevol columna, excepte «Invitació».

![Dispositius i sessions, amb els noms tapats](img/06-usuaris-dispositius.png)

Feu clic en una fila per a obrir una finestra amb dos apartats:

- **Sessions obertes.** Cada fila és un navegador o una app on el compte ha iniciat sessió: mostra si és «Dashboard» o «App», el navegador i el sistema, l'«Inici» i el «Darrer ús». «Fes expirar» tanca eixa sessió; «Fes expirar totes» les tanca totes. La persona haurà de tornar a entrar amb la contrasenya. La sessió es tanca del tot en un màxim de 15 minuts.
- **Notificacions.** Cada fila és un dispositiu que rep notificacions. «Envia una prova» li envia una notificació de prova i «Elimina» el dona de baixa; el membre el pot tornar a activar des de la seua app.

Si no hi ha res, la finestra diu «Cap sessió oberta.» i «Cap dispositiu rep notificacions.».

Si feu expirar les vostres pròpies sessions, el Dashboard continua funcionant uns minuts i després us porta a la pantalla d'inici de sessió.

## Privacitat i legal (només administradors)

Si no sou administradors, no veureu esta targeta. És normal.

- Hi ha dos textos: «Política de Privacitat» i «Avís de confidencialitat».
- «Desa correcció» canvia el text sense demanar res a ningú. És per a faltes i detalls.
- «Publica versió nova (cal reacceptar)» obliga **tots els usuaris** a tornar a acceptar el text la pròxima vegada que entren.
- «Veure historial de versions» mostra les versions anteriors.

## Compte amb

- Un membre que intenta entrar al Dashboard torna a la pantalla d'entrada: no té permís.
- La xicalla no pot rebre invitació. A la seua fitxa, el botó «Crea enllaç d'invitació» està desactivat: primer cal l'adult responsable.
- No podeu canviar-vos el rol ni desactivar el vostre compte.
- Una tècnica no pot desactivar ni canviar el compte d'un administrador.
- Si el missatge de l'enllaç d'invitació s'ha perdut, no passa res: torneu a crear-lo.

## Relacionat

- [Persones](03-persones.md): enllaç d'invitació, adult responsable, delegacions
- [L'app dels membres (PWA)](19-pwa.md): activar el compte i què veu un membre
- [Primers passos](01-primers-passos.md): entrar i eixir
