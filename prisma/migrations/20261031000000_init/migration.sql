-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Twibbon" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL DEFAULT 'Anonim',
    "imageName" TEXT NOT NULL,
    "isSeed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Twibbon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Twibbon_slug_key" ON "Twibbon"("slug");

-- CreateIndex
CREATE INDEX "Twibbon_createdAt_idx" ON "Twibbon"("createdAt");

-- CreateIndex
CREATE INDEX "Twibbon_expiresAt_idx" ON "Twibbon"("expiresAt");
