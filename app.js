const { format } = require("date-fns");
var isValid = require("date-fns/isValid");
const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "todoApplication.db");

let db = null;

const createDbAndStartServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log(`SERVER IS RUNNING AT http://localhost:3000/`);
    });
  } catch (error) {
    console.log(`DB ERROR MESSAGE ${error.message}`);
    process.exit(1);
  }
};

createDbAndStartServer();

const givenObjectToRequiredObject = (DbObject) => {
  return {
    id: DbObject.id,
    todo: DbObject.todo,
    priority: DbObject.priority,
    status: DbObject.status,
    category: DbObject.category,
    dueDate: DbObject.due_date,
  };
};

app.get("/todos/", async (request, response) => {
  const { status, priority, search_q = "", category } = request.query;
  let getDbQuery = null;
  let getDataOn = null;

  if (priority !== undefined && status !== undefined) {
    getDbQuery = `SELECT * FROM todo WHERE priority='${priority}' AND status='${status}';`;
  } else if (category !== undefined && status !== undefined) {
    getDbQuery = `SELECT * FROM todo WHERE category='${category}' AND status='${status}';`;
  } else if (category !== undefined && priority !== undefined) {
    getDbQuery = `SELECT * FROM todo WHERE category='${category}' AND priority='${priority}';`;
  } else if (search_q !== "") {
    getDbQuery = `SELECT * FROM todo WHERE todo LIKE '%${search_q}%';`;
  } else if (category !== undefined) {
    getDbQuery = `SELECT * FROM todo WHERE category='${category}';`;
    getDataOn = "Category";
  } else if (priority !== undefined) {
    getDbQuery = `SELECT * FROM todo WHERE priority='${priority}';`;
    getDataOn = "Priority";
  } else if (status !== undefined) {
    getDbQuery = `SELECT * FROM todo WHERE status='${status}';`;
    getDataOn = "Status";
  }

  let data = await db.all(getDbQuery);
  if (data.length !== 0) {
    response.send(
      data.map((eachData) => givenObjectToRequiredObject(eachData))
    );
  } else {
    response.status(400);
    response.send(`Invalid Todo ${getDataOn}`);
  }
});

//get data on id
app.get("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const getUniqueDataQuery = `SELECT * FROM todo WHERE id=${todoId};`;
  let data = await db.get(getUniqueDataQuery);
  response.send(givenObjectToRequiredObject(data));
});

//get data on /agenda/
app.get("/agenda/", async (request, response) => {
  const { date } = request.query;
  if (isValid(new Date(date))) {
    let formatDate = format(new Date(date), "yyyy-MM-dd");
    const getDataOnDateQuery = `SELECT * FROM todo WHERE due_date = '${formatDate}';`;
    let data = await db.all(getDataOnDateQuery);
    if (data.length !== 0) {
      response.send(
        data.map((eachData) => givenObjectToRequiredObject(eachData))
      );
    } else {
      response.status(400);
      response.send("Invalid Due Date");
    }
  } else {
    response.status(400);
    response.send("Invalid Due Date");
  }
});

//post data
app.post("/todos/", async (request, response) => {
  const { id, todo, priority, status, category, dueDate = "" } = request.body;

  if (status !== "TO DO" && status !== "IN PROGRESS" && status !== "DONE") {
    response.status(400);
    response.send("Invalid Todo Status");
  } else if (
    priority !== "HIGH" &&
    priority !== "MEDIUM" &&
    priority !== "LOW"
  ) {
    response.status(400);
    response.send("Invalid Todo Priority");
  } else if (todo === undefined) {
    response.status(400);
    response.send("Invalid Todo");
  } else if (
    category !== "WORK" &&
    category !== "HOME" &&
    category !== "LEARNING"
  ) {
    response.status(400);
    response.send("Invalid Todo Category");
  } else if (isValid(new Date(dueDate)) === false) {
    response.status(400);
    response.send("Invalid Due Date");
  } else {
    const insertDataQuery = `INSERT INTO todo (id,todo,category,priority,status,due_date)
  VALUES(${id},'${todo}','${category}','${priority}','${status}','${dueDate}');`;
    await db.run(insertDataQuery);
    response.send("Todo Successfully Added");
  }
});

//put data
app.put("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const dataObject = request.body;
  let update = null;
  if (dataObject.todo !== undefined) {
    update = "Todo";
  } else if (dataObject.category !== undefined) {
    update = "Category";
    if (
      dataObject.category !== "WORK" &&
      dataObject.category !== "HOME" &&
      dataObject.category !== "LEARNING"
    ) {
      response.status(400);
      response.send("Invalid Todo Category");
    }
  } else if (dataObject.priority !== undefined) {
    update = "Priority";
    if (
      dataObject.priority !== "HIGH" &&
      dataObject.priority !== "MEDIUM" &&
      dataObject.priority !== "LOW"
    ) {
      response.status(400);
      response.send("Invalid Todo Priority");
    }
  } else if (dataObject.status !== undefined) {
    update = "Status";
    if (
      dataObject.status !== "TO DO" &&
      dataObject.status !== "IN PROGRESS" &&
      dataObject.status !== "DONE"
    ) {
      response.status(400);
      response.send("Invalid Todo Status");
    }
  } else if (dataObject.dueDate !== undefined) {
    update = "Due Date";
    if (isValid(new Date(dataObject.dueDate)) === false) {
      response.status(400);
      response.send("Invalid Due Date");
    }
  }
  let uniqueDataQuery = `SELECT * FROM todo WHERE id=${todoId};`;
  let uniqueData = await db.get(uniqueDataQuery);
  const {
    id = uniqueData.id,
    todo = uniqueData.todo,
    priority = uniqueData.priority,
    status = uniqueData.status,
    category = uniqueData.category,
    dueDate = uniqueData.due_date,
  } = request.body;
  if (update !== null) {
    let updateDataQuery = `UPDATE todo SET id=${id},todo='${todo}',category='${category}',priority='${priority}',status='${status}',due_date='${dueDate}' WHERE id=${todoId};`;
    let data = await db.run(updateDataQuery);
    response.send(`${update} Updated`);
  } else {
    response.send(`Invalid Todo ${update}`);
  }
});

//delete data on unique id
app.delete("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  let deleteQuery = `DELETE FROM todo WHERE id=${todoId};`;
  await db.run(deleteQuery);
  response.send("Todo Deleted");
});

module.exports = app;
