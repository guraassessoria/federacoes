/*
  Warnings:

  - The values [DVA] on the enum `StructureType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StructureType_new" AS ENUM ('BP', 'DRE', 'DFC', 'DMPL', 'DRA');
ALTER TABLE "StandardStructure" ALTER COLUMN "type" TYPE "StructureType_new" USING ("type"::text::"StructureType_new");
ALTER TYPE "StructureType" RENAME TO "StructureType_old";
ALTER TYPE "StructureType_new" RENAME TO "StructureType";
DROP TYPE "StructureType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'GESTOR';
