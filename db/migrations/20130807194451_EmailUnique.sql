
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied
CREATE UNIQUE INDEX email ON users (email);

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back
DROP INDEX email;
