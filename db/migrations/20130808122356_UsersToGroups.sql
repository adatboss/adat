
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied
CREATE TABLE users_to_groups (
	user_id uuid REFERENCES users(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	group_id uuid REFERENCES groups(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	PRIMARY KEY (user_id, group_id)
);
CREATE INDEX ON users_to_groups(group_id);

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back
DROP TABLE users_to_groups;
