
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied
ALTER TABLE groups ADD permissions text[];
UPDATE groups SET permissions = '{}';
ALTER TABLE groups ALTER permissions SET NOT NULL;


-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back
ALTER TABLE groups DROP permissions;
