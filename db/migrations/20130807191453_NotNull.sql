
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied
ALTER TABLE users ALTER name SET NOT NULL, ALTER email SET NOT NULL, ALTER created SET NOT NULL;
ALTER TABLE groups ALTER name SET NOT NULL, ALTER created SET NOT NULL;

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back
ALTER TABLE users ALTER name DROP NOT NULL, ALTER email DROP NOT NULL, ALTER created DROP NOT NULL;
ALTER TABLE groups ALTER name DROP NOT NULL, ALTER created DROP NOT NULL;
