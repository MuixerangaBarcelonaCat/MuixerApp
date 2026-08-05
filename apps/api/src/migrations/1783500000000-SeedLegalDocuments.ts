import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds version 1 of the privacy policy and the transparency clause.
 * These are STARTER texts with placeholders (`[COLLA]`, `[NIF]`, `[CONTACTE]`) — they must be
 * reviewed by someone with legal criteria and completed from /config/legal before production use.
 */

const PRIVACY_POLICY_V1 = `# Política de Privacitat

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

const TRANSPARENCY_CLAUSE_V1 = `Les dades que introdueixes les tracta **[COLLA]** amb la finalitat de
gestionar la massa social, l'assistència i la planificació de pinyes. Són d'ús estrictament intern
i no es cedeixen a tercers. Pots exercir els teus drets a [CONTACTE]. Consulta la Política de
Privacitat per a més informació.`;

export class SeedLegalDocuments1783500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "legal_documents" ("type", "version", "content", "isActive", "publishedAt")
       VALUES ($1, $2, $3, true, now())`,
      ['PRIVACY_POLICY', 1, PRIVACY_POLICY_V1],
    );
    await queryRunner.query(
      `INSERT INTO "legal_documents" ("type", "version", "content", "isActive", "publishedAt")
       VALUES ($1, $2, $3, true, now())`,
      ['TRANSPARENCY_CLAUSE', 1, TRANSPARENCY_CLAUSE_V1],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "legal_documents"
       WHERE "version" = 1 AND "type" IN ('PRIVACY_POLICY', 'TRANSPARENCY_CLAUSE')`,
    );
  }
}
