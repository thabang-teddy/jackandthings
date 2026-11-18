# Django's MySQL backend expects the C driver "mysqlclient" (MySQLdb). On shared hosting it often
# can't be compiled, so we use pure-Python PyMySQL pretending to be MySQLdb. Django checks the
# version number, so we report the minimum it accepts. Remove this block if mysqlclient installs.
try:
    import pymysql

    pymysql.version_info = (2, 2, 1, "final", 0)
    pymysql.install_as_MySQLdb()
except ImportError:
    pass
