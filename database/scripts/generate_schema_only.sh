#!/bin/bash

# TerraHost Schema Generator for Draw.io
# This script generates a clean SQL schema file with tables only
# (no indexes, triggers, comments, or data)

OUTPUT_FILE="database/schema_for_drawio.sql"

echo "🎨 Generating clean schema for Draw.io..."
echo "-- TerraHost Database Schema for Draw.io" > "$OUTPUT_FILE"
echo "-- Generated: $(date)" >> "$OUTPUT_FILE"
echo "-- Tables only (no indexes, triggers, or data)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Extract CREATE TABLE statements from all migrations
echo "-- Enable extensions" >> "$OUTPUT_FILE"
echo "CREATE EXTENSION IF NOT EXISTS postgis;" >> "$OUTPUT_FILE"
echo "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "-- Enum types" >> "$OUTPUT_FILE"
grep "^CREATE TYPE" database/migrations/001_init_database.sql >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "-- Tables" >> "$OUTPUT_FILE"
for migration_file in database/migrations/*.sql; do
    echo "-- From $(basename "$migration_file")" >> "$OUTPUT_FILE"
    
    # Extract CREATE TABLE statements (multi-line)
    awk '
    /^CREATE TABLE/ {
        print_table = 1
        print $0
        next
    }
    print_table && /^);/ {
        print $0
        print ""
        print_table = 0
        next
    }
    print_table {
        # Skip lines with constraints that reference other tables
        if ($0 !~ /REFERENCES.*ON DELETE/ && $0 !~ /^CREATE INDEX/ && $0 !~ /^CREATE TRIGGER/) {
            print $0
        }
    }
    ' "$migration_file" >> "$OUTPUT_FILE"
done

echo "✅ Schema generated: $OUTPUT_FILE"
echo "📊 Ready for import to Draw.io ERD tools"
