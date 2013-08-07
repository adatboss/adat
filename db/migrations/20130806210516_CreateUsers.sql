
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied
CREATE TABLE users (
    id uuid NOT NULL,
    name text,
    email text,
    created timestamp with time zone
);
ALTER TABLE ONLY users ADD CONSTRAINT users_pkey PRIMARY KEY (id);



-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back
DROP TABLE users;

