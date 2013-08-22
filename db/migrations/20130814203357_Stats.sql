
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied
CREATE TABLE metrics (
	id BIGSERIAL PRIMARY KEY,
	name TEXT UNIQUE
);

CREATE TABLE stats (
	metric_id BIGINT,
	timestamp BIGINT,
	value DOUBLE PRECISION NOT NULL,
	PRIMARY KEY (metric_id, timestamp)
);

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back
DROP TABLE metrics, stats;
