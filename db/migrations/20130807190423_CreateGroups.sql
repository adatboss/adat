
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied
CREATE TABLE groups (
    id uuid,
    name text,
    created timestamp with time zone
);
ALTER TABLE ONLY groups ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back
DROP TABLE groups;
