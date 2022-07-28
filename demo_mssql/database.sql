USE db2graphql;

CREATE TABLE users
(
  id bigint PRIMARY KEY IDENTITY(1,1),
  username character varying(64),
  password character varying(255),
  firstname character varying(64),
  lastname character varying(64)
);

CREATE TABLE categories
(
  id bigint PRIMARY KEY IDENTITY(1,1),
  title character varying(120)
);

CREATE TABLE posts
(
  id bigint PRIMARY KEY IDENTITY(1,1),
  users_id bigint,
  title character varying(120),
  categories_id bigint,
  publish bit,
  CONSTRAINT postscategoriesfk FOREIGN KEY (categories_id)
      REFERENCES categories (id),
  CONSTRAINT postsusersfk FOREIGN KEY (users_id)
      REFERENCES users (id)
);

INSERT INTO users (username, password, firstname, lastname) VALUES ('john', '123', 'john', 'travolta');
INSERT INTO users (username, password, firstname, lastname) VALUES ('sandra', '123', 'sandra', 'bullock');

INSERT INTO categories (title) VALUES ('Cinema');
INSERT INTO categories (title) VALUES ('Media');

INSERT INTO posts (title, users_id, categories_id, publish) VALUES ('First post', 1, 1, 'true');
INSERT INTO posts (title, users_id, categories_id, publish) VALUES ('Second post', 1, 2, 'true');
INSERT INTO posts (title, users_id, categories_id, publish) VALUES ('Third post', 2, 1, 'true');
INSERT INTO posts (title, users_id, categories_id, publish) VALUES ('Forth post', 2, 2, 'false');
