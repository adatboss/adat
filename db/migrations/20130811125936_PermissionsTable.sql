
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied
ALTER TABLE groups DROP permissions;
CREATE TABLE permissions (
	id bigserial PRIMARY KEY,
	group_id uuid NOT NULL REFERENCES groups(id),
	method text,
	object_type text,
	object_id uuid
);
CREATE INDEX ON permissions(group_id);

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back
DROP TABLE permissions;
ALTER TABLE groups ADD permissions text[];
UPDATE groups SET permissions = '{}';
ALTER TABLE groups ALTER permissions SET NOT NULL;
