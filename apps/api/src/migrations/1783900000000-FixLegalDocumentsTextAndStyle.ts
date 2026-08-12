import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes the v1 seed texts from SeedLegalDocuments1783500000000: they contained Markdown markers
 * (the content is rendered as plaintext, not Markdown) and did not follow the UI language style
 * guide (informal "tu" instead of "vós", "aquesta" instead of valencian "esta", "espatlla" instead
 * of "espatla"). Updates the existing version=1 rows in place — no version bump, no re-consent.
 */

const PRIVACY_POLICY_V1_FIXED = `1. Responsable del tractament
El responsable de les vostres dades és [COLLA] (NIF [NIF]), associació sense ànim de lucre. Contacte: [CONTACTE].

2. Quines dades tractem i amb quina finalitat
Tractem dades identificatives i de contacte (nom, cognoms, àlies, email, telèfon, data de naixement, gènere i alçada d'espatla) amb l'única finalitat de gestionar la massa social de la colla: control de membres, assistència a assajos i actuacions, i disseny i planificació de figures (pinyes).

3. Base jurídica
El tractament es fonamenta en la relació associativa que vos vincula amb la colla. En el cas de persones menors d'edat, el tractament es fa amb el consentiment del seu tutor o tutora legal.

4. Ús estrictament intern
Les vostres dades són d'ús estrictament intern de la colla. No es cedeixen a tercers ni s'utilitzen amb cap finalitat comercial.

5. Conservació
Conservem les dades mentre es mantinga la relació associativa. Un cop finalitzada, s'anonimitzen conservant únicament l'històric de participació i assistència de forma anònima.

6. Els vostres drets
Podeu exercir els drets d'accés, rectificació, supressió (dret a l'oblit), oposició, limitació i portabilitat adreçant-vos a [CONTACTE].

7. Seguretat
Apliquem mesures tècniques i organitzatives: control d'accés per rols, autenticació segura i registre d'activitat per a auditories.

8. Menors d'edat
Les dades de la xicalla es tracten amb el consentiment del seu tutor o tutora legal, que actua en el seu nom.

9. Canvis en esta política
Si publiquem una versió nova d'esta política, vos demanem que la torneu a acceptar.`;

const TRANSPARENCY_CLAUSE_V1_FIXED = `Les dades que introduïu les tracta [COLLA] amb la finalitat de gestionar la massa social, l'assistència i la planificació de pinyes. Són d'ús estrictament intern i no es cedeixen a tercers. Podeu exercir els vostres drets a [CONTACTE]. Consulteu la Política de Privacitat per a més informació.`;

const PRIVACY_POLICY_V1_ORIGINAL = `# Política de Privacitat

## 1. Responsable del tractament
El responsable de les teues dades és **[COLLA]** (NIF [NIF]), associació sense ànim de lucre.
Contacte: [CONTACTE].

## 2. Quines dades tractem i amb quina finalitat
Tractem dades identificatives i de contacte (nom, cognoms, àlies, email, telèfon, data de
naixement, gènere i alçada d'espatlla) amb l'única finalitat de gestionar la massa social de la
colla: control de membres, assistència a assajos i actuacions, i disseny i planificació de figures
(pinyes).

## 3. Base jurídica
El tractament es fonamenta en la relació associativa que et vincula amb la colla. En el cas de
persones menors d'edat, el tractament es fa amb el consentiment del seu tutor o tutora legal.

## 4. Ús estrictament intern
Les teues dades són d'**ús estrictament intern** de la colla. **No es cedeixen a tercers ni
s'utilitzen amb cap finalitat comercial.**

## 5. Conservació
Conservem les dades mentre es mantinga la relació associativa. Un cop finalitzada, s'anonimitzen
conservant únicament l'històric de participació i assistència de forma anònima.

## 6. Els teus drets
Pots exercir els drets d'accés, rectificació, supressió (dret a l'oblit), oposició, limitació i
portabilitat adreçant-te a [CONTACTE].

## 7. Seguretat
Apliquem mesures tècniques i organitzatives: control d'accés per rols, autenticació segura i
registre d'activitat per a auditories.

## 8. Menors d'edat
Les dades de la xicalla es tracten amb el consentiment del seu tutor o tutora legal, que actua en
el seu nom.

## 9. Canvis en aquesta política
Si publiquem una versió nova d'aquesta política, et demanarem que la tornes a acceptar.`;

const TRANSPARENCY_CLAUSE_V1_ORIGINAL = `Les dades que introdueixes les tracta **[COLLA]** amb la finalitat de
gestionar la massa social, l'assistència i la planificació de pinyes. Són d'ús estrictament intern
i no es cedeixen a tercers. Pots exercir els teus drets a [CONTACTE]. Consulta la Política de
Privacitat per a més informació.`;

export class FixLegalDocumentsTextAndStyle1783900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "legal_documents" SET "content" = $1 WHERE "type" = 'PRIVACY_POLICY' AND "version" = 1`,
      [PRIVACY_POLICY_V1_FIXED],
    );
    await queryRunner.query(
      `UPDATE "legal_documents" SET "content" = $1 WHERE "type" = 'TRANSPARENCY_CLAUSE' AND "version" = 1`,
      [TRANSPARENCY_CLAUSE_V1_FIXED],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "legal_documents" SET "content" = $1 WHERE "type" = 'PRIVACY_POLICY' AND "version" = 1`,
      [PRIVACY_POLICY_V1_ORIGINAL],
    );
    await queryRunner.query(
      `UPDATE "legal_documents" SET "content" = $1 WHERE "type" = 'TRANSPARENCY_CLAUSE' AND "version" = 1`,
      [TRANSPARENCY_CLAUSE_V1_ORIGINAL],
    );
  }
}
