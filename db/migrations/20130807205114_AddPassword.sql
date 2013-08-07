
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied
ALTER TABLE users ADD password text;
UPDATE users SET password = '$2a$10$qbT5Dt.NyEGQ03vZaSVaQ.WC0elGKOM2PtqjNUqwbUDLhs3PGG5Eq';
ALTER TABLE users ALTER password SET NOT NULL;

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back
ALTER TABLE users DROP password;
