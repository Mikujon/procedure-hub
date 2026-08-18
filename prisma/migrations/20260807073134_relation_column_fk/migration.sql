-- AddForeignKey
ALTER TABLE "database_row_relations" ADD CONSTRAINT "database_row_relations_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "database_columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
