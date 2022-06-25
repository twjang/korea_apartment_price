import re
import hashlib
import datetime
from typing import Any, Dict, List, Optional

import jwt
from peewee import *
from korea_apartment_price.webapp import *

if DB_TYPE == 'sqlite':
  db = SqliteDatabase(DB_NAME, **DB_ARGS)
elif DB_TYPE == 'mysql':
  db = MySQLDatabase(DB_NAME, **DB_ARGS)
else:
  raise ValueError(f'Unsupported db type {DB_TYPE}')


class BaseModel(Model):
  class Meta:
    database = db


class User(BaseModel):
  id = PrimaryKeyField()
  email = CharField(255, unique=True)
  pwhash = CharField(255)
  is_admin = BooleanField(index=True)
  is_active = BooleanField(index=True)
  date_created = DateTimeField(default=datetime.datetime.now, index=True)
  settings = TextField(default='{}')

  @classmethod
  def check_email(cls, email:str)->bool:
    matched = re.match(r'^[0-9a-zA-Z._\-]+@([a-zA-Z0-9._\-]+)$', email) 
    if matched is None:
      return False
    domain = matched.group(1)
    import socket
    try:
      socket.gethostbyname_ex(domain)
    except socket.gaierror:
      return False
    return True

  @classmethod
  def hash_password(cls, email:str, password:str)->str:
    m = hashlib.sha256()
    m.update(SALT.encode('utf-8'))
    m.update(('/' + email + ':' + password).encode('utf-8'))
    return m.hexdigest()

  @classmethod
  def register(cls, email: str, password:str, is_admin=False, is_active=False)->Optional["User"]:
    email = email.strip()
    if not cls.check_email(email):
      return None

    u = cls()
    u.email = email
    u.pwhash = cls.hash_password(email, password)
    u.is_admin = is_admin
    u.is_active = is_active
    u.date_created = datetime.datetime.now()
    u.save()
    return u
  
  @classmethod
  def login(cls, email:str, password:str)->Optional["User"]:
    email = email.strip()
    if email == 'admin' and password == ADMIN_PASSWORD:
      return User(email='admin', pwhash='', is_active=True, is_admin=True)

    pwhash = cls.hash_password(email, password)
    try:
      return cls.get(email=email, pwhash=pwhash, is_active=True)
    except cls.DoesNotExist:
      return None


  def to_jwt(self)->bytes: 
    data ={
      'user': {
        'id': self.id,
        'email': self.email,
        'is_admin': self.is_admin,
        'is_active': self.is_active,
      },
      'exp': datetime.datetime.now(tz=datetime.timezone.utc) + datetime.timedelta(hours=24),
    }
    return jwt.encode(data, key=JWT_SECRET)
  
  @classmethod
  def from_jwt(cls, data:str)->"User":
    decoded = jwt.decode(data, key=JWT_SECRET, algorithms=['HS256'])
    if 'user' in decoded:
      return cls(**decoded['user'])
    raise ValueError('cannot restore User object from jtw token')
  
  @property
  def is_real(self):
    return self.id is not None


class Favorite(BaseModel):
  class Meta:
    indexes = (
        (("user_id", "lawaddrcode", 'name', 'size'), True),
    )

  id = PrimaryKeyField()
  user = ForeignKeyField(User)
  lawaddrcode = CharField()
  address = CharField()
  name = CharField()
  size = IntegerField()

  @classmethod
  def list(cls, user:"User")->Dict[str, List[Dict[str, Any]]]:
    res = {}
    for fav in cls.select().join(User, attr=['id']).where(User.id == user.id).order_by(Favorite.address, Favorite.name, Favorite.size):
      if not fav.address in res:
        res[fav.address] = []
      res[fav.address].append({'id':fav.id, 'name': fav.name, 'size': fav.size})
    return res
  
  def as_dict(self):
    return {
      'name': self.name,
      'lawaddrcode': self.lawaddrcode,
      'address': self.address,
      'size': self.size
    }

for table in [User, Favorite]:
  if not table.table_exists():
    table.create_table()