
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied
CREATE TABLE dashboards (
	id uuid PRIMARY KEY,
	title text NOT NULL,
	slug text UNIQUE NOT NULL,
	category text NOT NULL,
	position int NOT NULL,
	created timestamp with time zone NOT NULL,
	creator uuid REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back
DROP TABLE dashboards;
